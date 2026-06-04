"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Bot, User, ChevronDown, ChevronUp, X, Loader2, Sparkles, MessageSquare, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SeverityBadge } from "@/components/findings/SeverityBadge"
import { ForumNotes } from "@/components/forum/ForumNotes"

interface ObservationItem {
  id: string
  content: string
  status: string
  createdAt: string
}

interface FindingItem {
  id: string
  title: string
  description: string
  severity: string
  host: string | null
}

interface ContextItem {
  type: "observation" | "finding"
  id: string
  label: string
  content: string
  severity?: string
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface Props {
  engagementId: string
  engagementName: string
  observations: ObservationItem[]
  findings: FindingItem[]
  initialNotes: string | null
}

const QUICK_PROMPTS = [
  "Expand the selected observation with technical depth and exploitation steps",
  "What attack chains can be built from the selected findings?",
  "Are there any gaps or missing findings based on what's selected?",
  "Draft a risk narrative for the client based on the selected context",
]

function uid() {
  return Math.random().toString(36).slice(2)
}

export function ForumPage({ engagementId, engagementName, observations, findings, initialNotes }: Props) {
  const [tab, setTab] = useState<"chat" | "notes">("chat")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [obsExpanded, setObsExpanded] = useState(true)
  const [findingsExpanded, setFindingsExpanded] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function buildContextItems(): ContextItem[] {
    const items: ContextItem[] = []
    for (const obs of observations) {
      if (selectedIds.has(obs.id)) {
        items.push({
          type: "observation",
          id: obs.id,
          label: obs.content.slice(0, 60) + (obs.content.length > 60 ? "…" : ""),
          content: obs.content,
        })
      }
    }
    for (const f of findings) {
      if (selectedIds.has(f.id)) {
        items.push({
          type: "finding",
          id: f.id,
          label: f.title,
          content: [f.description, f.host ? `Host: ${f.host}` : ""].filter(Boolean).join("\n"),
          severity: f.severity,
        })
      }
    }
    return items
  }

  const sendMessage = useCallback(async (text: string) => {
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
      const res = await fetch("/api/ai/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId,
          messages: apiMessages,
          contextItems: buildContextItems(),
        }),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, messages, engagementId, selectedIds])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const contextItems = buildContextItems()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left panel ── */}
      <aside className="w-64 shrink-0 border-r flex flex-col bg-muted/10">
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Context
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Click items to include in AI context
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Observations */}
          <div className="border-b">
            <button
              onClick={() => setObsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium hover:bg-muted/30"
            >
              <span>Observations ({observations.length})</span>
              {obsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {obsExpanded && (
              <div className="divide-y">
                {observations.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No observations yet</p>
                )}
                {observations.map((obs) => {
                  const selected = selectedIds.has(obs.id)
                  return (
                    <button
                      key={obs.id}
                      onClick={() => toggleItem(obs.id)}
                      className={`w-full text-left px-4 py-2.5 transition-colors ${
                        selected
                          ? "bg-primary/10 border-l-2 border-primary"
                          : "hover:bg-muted/30 border-l-2 border-transparent"
                      }`}
                    >
                      <p className="text-xs leading-snug line-clamp-2 text-foreground">
                        {obs.content}
                      </p>
                      <span
                        className={`text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded-full ${
                          obs.status === "raw"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : obs.status === "promoted"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {obs.status}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Findings */}
          <div>
            <button
              onClick={() => setFindingsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium hover:bg-muted/30"
            >
              <span>Findings ({findings.length})</span>
              {findingsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {findingsExpanded && (
              <div className="divide-y">
                {findings.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No findings yet</p>
                )}
                {findings.map((f) => {
                  const selected = selectedIds.has(f.id)
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleItem(f.id)}
                      className={`w-full text-left px-4 py-2.5 transition-colors ${
                        selected
                          ? "bg-primary/10 border-l-2 border-primary"
                          : "hover:bg-muted/30 border-l-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <SeverityBadge severity={f.severity} />
                      </div>
                      <p className="text-xs mt-1 leading-snug line-clamp-2 text-foreground">
                        {f.title}
                      </p>
                      {f.host && (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                          {f.host}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="border-t px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header + tabs */}
        <div className="shrink-0 border-b px-5 py-3 flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-sm leading-none">AI Forum</p>
            <p className="text-xs text-muted-foreground mt-0.5">{engagementName}</p>
          </div>

          {/* Tab switcher */}
          <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5 bg-muted/30">
            <button
              onClick={() => setTab("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === "chat"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              AI Chat
            </button>
            <button
              onClick={() => setTab("notes")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === "notes"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3 w-3" />
              Notes
            </button>
          </div>

          {tab === "chat" && contextItems.length > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              {contextItems.length} item{contextItems.length !== 1 ? "s" : ""} in context
            </span>
          )}
        </div>

        {/* Notes tab */}
        {tab === "notes" && (
          <div className="flex-1 overflow-hidden">
            <ForumNotes engagementId={engagementId} initialContent={initialNotes} />
          </div>
        )}

        {/* Messages */}
        {tab === "chat" && <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium mb-1">Ask the AI anything about this engagement</p>
              <p className="text-xs text-muted-foreground mb-6 max-w-xs">
                Select observations or findings from the panel on the left to give the AI specific context
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs text-left px-3 py-2.5 rounded-lg border hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {prompt}
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
                  className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {msg.content || (
                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking…
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>}

        {/* Context chips */}
        {tab === "chat" && contextItems.length > 0 && (
          <div className="shrink-0 px-5 py-2 border-t flex items-center gap-2 flex-wrap bg-muted/10">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Context:</span>
            {contextItems.map((item) => (
              <span
                key={item.id}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted border"
              >
                {item.type === "finding" && item.severity && (
                  <span className="font-mono uppercase text-[9px] font-bold opacity-60">
                    {item.severity[0]}
                  </span>
                )}
                <span className="max-w-[140px] truncate">{item.label}</span>
                <button onClick={() => toggleItem(item.id)}>
                  <X className="h-2.5 w-2.5 opacity-50 hover:opacity-100" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input (chat only) */}
        {tab === "chat" && <div className="shrink-0 border-t px-5 py-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask the AI… (Enter to send, Shift+Enter for newline)"
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
        </div>}
      </div>
    </div>
  )
}
