import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { generateAIResponse, getProviderStatus } from "@/lib/ai/provider"
import { buildExecutiveSummaryPrompt } from "@/lib/ai/prompts/executive-summary"
import type { Finding, FindingChainLink } from "@/types"

const requestSchema = z.object({
  engagementId: z.string().cuid(),
  findingChain: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        explanation: z.string(),
      })
    )
    .default([]),
})

// ---------------------------------------------------------------------------
// In-memory per-user rate limiter for the AI draft-summary endpoint
// Allows at most SUMMARY_MAX_REQUESTS per SUMMARY_WINDOW_MS per user.
// ---------------------------------------------------------------------------
const SUMMARY_WINDOW_MS = 60 * 1000 // 1 minute
const SUMMARY_MAX_REQUESTS = 20

const summaryRequests = new Map<string, { count: number; windowStart: number }>()

function isUserRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = summaryRequests.get(userId)
  if (!entry || now - entry.windowStart > SUMMARY_WINDOW_MS) {
    summaryRequests.set(userId, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  if (entry.count > SUMMARY_MAX_REQUESTS) return true
  return false
}

// Per-engagement cooldown: at most 1 summary generation per 5 minutes per engagement
const ENGAGEMENT_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
const engagementLastRun = new Map<string, number>()

function isEngagementCoolingDown(engagementId: string): boolean {
  const now = Date.now()
  const last = engagementLastRun.get(engagementId)
  if (last && now - last < ENGAGEMENT_COOLDOWN_MS) return true
  engagementLastRun.set(engagementId, now)
  return false
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (isUserRateLimited(session.user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    )
  }

  const { configured } = getProviderStatus()
  if (!configured) {
    // Do not disclose the provider name to clients
    return NextResponse.json(
      { error: "AI features are not currently available.", unconfigured: true },
      { status: 503 }
    )
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  // Per-engagement cooldown check
  if (isEngagementCoolingDown(parsed.data.engagementId)) {
    return NextResponse.json(
      { error: "Summary generation is on cooldown. Please wait a few minutes before trying again." },
      { status: 429 }
    )
  }

  const engagement = await prisma.engagement.findFirst({
    where: { id: parsed.data.engagementId, userId: session.user.id },
    include: { findings: true, user: { select: { houseStyle: true } } },
  })
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rawDays = engagement.endDate
    ? Math.ceil(
        (engagement.endDate.getTime() - engagement.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null
  const durationDays = rawDays !== null && rawDays > 0 ? rawDays : null

  // Fetch TA coverage counts for coverage delta section
  let taObservationCounts: { confirmed: number; total: number } | null = null
  if (engagement.sspProfile) {
    const taObs = await prisma.observation.findMany({
      where: { engagementId: parsed.data.engagementId, source: "threatassessor" },
      select: { status: true },
    })
    if (taObs.length > 0) {
      taObservationCounts = {
        confirmed: taObs.filter((o) => o.status === "promoted").length,
        total: taObs.length,
      }
    }
  }

  const { system, user } = await buildExecutiveSummaryPrompt({
    clientName: engagement.clientName,
    clientBrief: engagement.clientBrief ?? "No brief provided.",
    findings: engagement.findings as Finding[],
    findingChain: parsed.data.findingChain as FindingChainLink[],
    houseStyle: engagement.user.houseStyle ?? "",
    engagementDuration: durationDays ? `${durationDays} days` : "Duration not specified",
    sspProfile: engagement.sspProfile,
    architectureName: engagement.architectureName,
    taObservationCounts,
  })

  try {
    const text = await generateAIResponse(user, system)
    return NextResponse.json({ text })
  } catch (e) {
    // Log the full error server-side; never expose internal details to the client
    console.error("[ai/draft-summary] provider error:", e)
    return NextResponse.json(
      { error: "Summary generation failed. Please try again later." },
      { status: 500 }
    )
  }
}
