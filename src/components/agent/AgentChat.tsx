"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Eye,
  FileSearch,
  FilePlus,
  MessageSquarePlus,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface Props {
  engagementId: string
  engagementName: string
}

const QUICK_PROMPTS = [
  { icon: Eye, text: "Summarise the current state of this engagement" },
  { icon: FileSearch, text: "List all findings and group them by severity" },
  { icon: MessageSquarePlus, text: "Show all raw observations that haven't been promoted yet" },
  { icon: FilePlus, text: "Promote the raw observations into findings where appropriate" },
  { icon: FileText, text: "Draft an executive summary for the report" },
]

function uid() {
  return Math.random().toString(36).slice(2)
}

export function AgentChat({ engagementId, engagementName }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [input])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed }
      const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "" }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput("")
      setLoading(true)

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        const res = await fetch("/api/agent/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ engagementId, messages: apiMessages }),
        })

        if (!res.ok || !res.body) {
          const errText = await res.text()
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...assistantMsg,
              content: `Error: ${errText || "Request failed"}`,
            }
            return updated
          })
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { ...assistantMsg, content: accumulated }
            return updated
          })
        }
      } catch (e) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...assistantMsg,
            content: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
          }
          return updated
        })
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, messages, engagementId]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="shrink-0 border-b px-5 py-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm leading-none">Agent</p>
          <p className="text-xs text-muted-foreground mt-0.5">{engagementName}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          autonomous
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium mb-1">What do you need?</p>
            <p className="text-xs text-muted-foreground mb-6 max-w-xs">
              The agent can read and write engagement data — observations, findings, summaries.
              Ask it anything or pick an action below.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {QUICK_PROMPTS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  onClick={() => sendMessage(text)}
                  className="flex items-center gap-2.5 text-xs text-left px-3 py-2.5 rounded-lg border hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </span>
              <div
                className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
                }`}
              >
                {msg.content || (
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Working…
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t px-5 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Tell the agent what to do… (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[42px] max-h-32 disabled:opacity-50"
            rows={1}
          />
          <Button
            size="sm"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="h-[42px] px-3 shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Agent can create observations and findings — review any writes it makes
        </p>
      </div>
    </div>
  )
}
