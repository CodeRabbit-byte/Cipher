import { NextRequest } from "next/server"
import { streamText } from "ai"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { getModel, getProviderStatus } from "@/lib/ai/provider"
import { z } from "zod"

const ContextItemSchema = z.object({
  type: z.enum(["observation", "finding"]),
  id: z.string(),
  label: z.string(),
  content: z.string(),
  severity: z.string().optional(),
})

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
})

const BodySchema = z.object({
  engagementId: z.string(),
  messages: z.array(MessageSchema).min(1),
  contextItems: z.array(ContextItemSchema).default([]),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { configured, provider } = getProviderStatus()
  if (!configured) {
    return new Response(
      `AI provider "${provider}" is not configured. Add the API key to your .env file.`,
      { status: 503 }
    )
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return new Response("Invalid input", { status: 400 })

  const { engagementId, messages, contextItems } = parsed.data

  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, userId: session.user.id },
    select: { name: true, clientName: true, clientBrief: true },
  })
  if (!engagement) return new Response("Not found", { status: 404 })

  const contextBlock =
    contextItems.length > 0
      ? `\n\n## Selected context\n\n${contextItems
          .map(
            (item) =>
              `### ${item.type === "finding" ? `Finding [${item.severity?.toUpperCase() ?? "?"}]` : "Observation"}: ${item.label}\n${item.content}`
          )
          .join("\n\n---\n\n")}`
      : ""

  const systemPrompt = `You are an expert penetration tester and cybersecurity analyst embedded in an active engagement.

Engagement: ${engagement.name}
Client: ${engagement.clientName}${engagement.clientBrief ? `\nBrief: ${engagement.clientBrief}` : ""}${contextBlock}

Your job:
- Expand observations with technical depth (root cause, exploitation steps, PoC ideas)
- Identify weaknesses, attack vectors, and potential finding chains
- Estimate severity and flag if an existing rating seems off
- Suggest evidence to collect and validation steps
- Reference CVEs, MITRE ATT&CK techniques, and OWASP categories where relevant
- Recommend concrete remediation

Be direct and technical. Avoid generic security advice — tie everything back to the specific context provided.`

  try {
    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
      maxTokens: 1500,
      temperature: 0.3,
    })
    return result.toTextStreamResponse()
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "AI error", { status: 500 })
  }
}
