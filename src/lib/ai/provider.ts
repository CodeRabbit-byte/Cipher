import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { google } from "@ai-sdk/google"
import { mistral } from "@ai-sdk/mistral"
import { createGroq } from "@ai-sdk/groq"

type SupportedProvider = "anthropic" | "openai" | "gemini" | "mistral" | "groq"

function getActiveModel() {
  const provider = (process.env.AI_PROVIDER ?? "anthropic") as SupportedProvider

  switch (provider) {
    case "anthropic":
      return {
        model: anthropic("claude-sonnet-4-20250514"),
        isConfigured: !!process.env.ANTHROPIC_API_KEY,
        provider,
      }
    case "openai":
      return {
        model: openai("gpt-4o"),
        isConfigured: !!process.env.OPENAI_API_KEY,
        provider,
      }
    case "gemini":
      return {
        model: google("gemini-1.5-flash"),
        isConfigured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        provider,
      }
    case "mistral":
      return {
        model: mistral("mistral-large-latest"),
        isConfigured: !!process.env.MISTRAL_API_KEY,
        provider,
      }
    case "groq":
      return {
        model: createGroq()("llama-3.3-70b-versatile"),
        isConfigured: !!process.env.GROQ_API_KEY,
        provider,
      }
    default:
      throw new Error(
        `Unknown AI_PROVIDER: "${provider}". Valid options: anthropic, openai, gemini, mistral, groq`
      )
  }
}

export async function generateAIResponse(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const { model, isConfigured, provider } = getActiveModel()

  if (!isConfigured) {
    throw new Error(
      `AI provider "${provider}" is not configured. ` +
        `Add the corresponding API key to your .env file.`
    )
  }

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt,
    maxOutputTokens: 2000,
    temperature: 0.4,
  })

  return text
}

export function getProviderStatus(): { provider: string; configured: boolean } {
  const { provider, isConfigured } = getActiveModel()
  return { provider, configured: isConfigured }
}

export function getModel() {
  const { model, isConfigured, provider } = getActiveModel()
  if (!isConfigured) throw new Error(`AI provider "${provider}" is not configured.`)
  return model
}
