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
  // Cap individual content items to prevent prompt stuffing
  content: z.string().max(20000),
  severity: z.string().optional(),
})

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  // Cap per-message content
  content: z.string().max(10000),
})

const BodySchema = z.object({
  engagementId: z.string(),
  messages: z.array(MessageSchema).min(1).max(50),
  contextItems: z.array(ContextItemSchema).default([]).max(20),
})

// ---------------------------------------------------------------------------
// In-memory per-user rate limiter for the AI forum endpoint
// Allows at most FORUM_MAX_REQUESTS per FORUM_WINDOW_MS per user.
// ---------------------------------------------------------------------------
const FORUM_WINDOW_MS = 60 * 1000 // 1 minute
const FORUM_MAX_REQUESTS = 20

const forumRequests = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = forumRequests.get(userId)
  if (!entry || now - entry.windowStart > FORUM_WINDOW_MS) {
    forumRequests.set(userId, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  if (entry.count > FORUM_MAX_REQUESTS) return true
  return false
}

// Maximum total context content characters
const MAX_CONTEXT_CHARS = 100000

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  if (isRateLimited(session.user.id)) {
    return new Response("Too many requests. Please slow down.", { status: 429 })
  }

  const { configured } = getProviderStatus()
  if (!configured) {
    // Do not disclose the provider name to clients
    return new Response("AI features are not currently available.", { status: 503 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return new Response("Invalid input", { status: 400 })

  const { engagementId, messages, contextItems } = parsed.data

  // Enforce total context size cap
  const totalContextChars = contextItems.reduce((sum, item) => sum + item.content.length, 0)
  if (totalContextChars > MAX_CONTEXT_CHARS) {
    return new Response("Context too large", { status: 400 })
  }

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
    // Log the full error server-side; never expose internal details to the client
    console.error("[ai/forum] provider error:", e)
    return new Response("AI service temporarily unavailable.", { status: 500 })
  }
}
