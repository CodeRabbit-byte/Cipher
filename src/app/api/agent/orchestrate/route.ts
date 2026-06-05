import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { getProviderStatus } from "@/lib/ai/provider"
import { runOrchestrator } from "@/lib/agents/orchestrator"
import { z } from "zod"

const bodySchema = z.object({
  engagementId: z.string().cuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { configured, provider } = getProviderStatus()
  if (!configured) {
    return new Response(
      `AI provider "${provider}" is not configured. Add the API key to your .env file and set AI_PROVIDER.`,
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return new Response("Invalid input", { status: 400 })

  const { engagementId, messages } = parsed.data

  try {
    const result = runOrchestrator(engagementId, session.user.id, messages)
    return result.toTextStreamResponse({ headers: { "Content-Type": "text/plain; charset=utf-8" } })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Agent error", { status: 500 })
  }
}
