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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { configured, provider } = getProviderStatus()
  if (!configured) {
    return NextResponse.json(
      {
        error: `AI provider "${provider}" is not configured. Add the corresponding API key to your .env file and set AI_PROVIDER.`,
        unconfigured: true,
      },
      { status: 503 }
    )
  }

  const body = await req.json()
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
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

  const { system, user } = buildExecutiveSummaryPrompt({
    clientName: engagement.clientName,
    clientBrief: engagement.clientBrief ?? "No brief provided.",
    findings: engagement.findings as Finding[],
    findingChain: parsed.data.findingChain as FindingChainLink[],
    houseStyle: engagement.user.houseStyle ?? "",
    engagementDuration: durationDays ? `${durationDays} days` : "Duration not specified",
  })

  try {
    const text = await generateAIResponse(user, system)
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed" },
      { status: 500 }
    )
  }
}
