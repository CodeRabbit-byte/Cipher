import { NextRequest } from "next/server"
import { streamText } from "ai"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { getModel, getProviderStatus } from "@/lib/ai/provider"
import { buildPurpleTeamPrompt } from "@/lib/ai/prompts/purple-team"

const requestSchema = z.object({
  engagementId: z.string().cuid(),
  perspective: z.enum(["red", "blue"]),
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
// In-memory per-user rate limiter for the AI purple-team endpoint
// Allows at most PURPLE_MAX_REQUESTS per PURPLE_WINDOW_MS per user.
// Shared across red and blue perspectives.
// ---------------------------------------------------------------------------
const PURPLE_WINDOW_MS = 60 * 1000 // 1 minute
const PURPLE_MAX_REQUESTS = 10

const purpleRequests = new Map<string, { count: number; windowStart: number }>()

function isUserRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = purpleRequests.get(userId)
  if (!entry || now - entry.windowStart > PURPLE_WINDOW_MS) {
    purpleRequests.set(userId, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  if (entry.count > PURPLE_MAX_REQUESTS) return true
  return false
}

// Per-engagement cooldown: 2 minutes between purple-team runs per engagement
// (shared across red and blue perspectives)
const ENGAGEMENT_COOLDOWN_MS = 2 * 60 * 1000 // 2 minutes
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
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  if (isUserRateLimited(session.user.id)) {
    return new Response("Too many requests. Please slow down.", { status: 429 })
  }

  const { configured } = getProviderStatus()
  if (!configured) {
    // Do not disclose the provider name to clients
    return new Response("AI features are not currently available.", { status: 503 })
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return new Response("Invalid input", { status: 400 })

  const { engagementId, perspective, findingChain } = parsed.data

  // Per-engagement cooldown check (shared across perspectives)
  if (isEngagementCoolingDown(engagementId)) {
    return new Response(
      "Purple team analysis is on cooldown. Please wait a few minutes before trying again.",
      { status: 429 }
    )
  }

  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, userId: session.user.id },
    include: { findings: true },
  })
  if (!engagement) return new Response("Not found", { status: 404 })

  const rawDays = engagement.endDate
    ? Math.ceil(
        (engagement.endDate.getTime() - engagement.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null
  const durationDays = rawDays !== null && rawDays > 0 ? rawDays : null

  const { system, user } = buildPurpleTeamPrompt(
    {
      clientName: engagement.clientName,
      clientBrief: engagement.clientBrief ?? "No brief provided.",
      scope: engagement.scope ?? null,
      findings: engagement.findings as any,
      findingChain: findingChain as any,
      engagementDuration: durationDays ? `${durationDays} days` : "Duration not specified",
    },
    perspective
  )

  try {
    const result = streamText({
      model: getModel(),
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 2000,
      temperature: 0.3,
    })
    return result.toTextStreamResponse()
  } catch (e) {
    // Log the full error server-side; never expose internal details to the client
    console.error("[ai/purple-team] provider error:", e)
    return new Response("AI service temporarily unavailable.", { status: 500 })
  }
}
