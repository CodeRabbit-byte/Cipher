"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ObservationCard } from "./ObservationCard"

interface Observation {
  id: string
  content: string
  source: string
  host: string | null | undefined
  status: string
  createdAt: string
  engagementId: string
}

interface Props {
  engagementId: string
  initialObservations: Observation[]
}

export function ObservationFeed({ engagementId, initialObservations }: Props) {
  const [observations, setObservations] = useState<Observation[]>(initialObservations)
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || saving) return

    setSaving(true)
    const res = await fetch("/api/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), engagementId }),
    })
    setSaving(false)

    if (res.ok) {
      const obs = await res.json()
      setObservations((prev) => [{ ...obs, createdAt: obs.createdAt }, ...prev])
      setContent("")
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/observations/${id}`, { method: "DELETE" })
    setObservations((prev) => prev.filter((o) => o.id !== id))
  }

  async function handleArchive(id: string) {
    await fetch(`/api/observations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    })
    setObservations((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "archived" } : o))
    )
  }

  function handlePromoted(id: string, findingId: string) {
    setObservations((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "promoted", findingId } : o))
    )
  }

  const visible = showArchived
    ? observations
    : observations.filter((o) => o.status !== "archived")

  const archivedCount = observations.filter((o) => o.status === "archived").length

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-6">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              void handleSubmit(e as unknown as React.FormEvent)
            }
          }}
          placeholder="Capture an observation… (Ctrl+K to focus, Ctrl+Enter to save)"
          className="resize-none text-base"
          rows={3}
          autoFocus
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">Ctrl+Enter to save</span>
          <Button type="submit" disabled={saving || !content.trim()}>
            {saving ? "Saving…" : "Save observation"}
          </Button>
        </div>
      </form>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No observations yet. Start capturing above.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((obs) => (
            <ObservationCard
              key={obs.id}
              observation={obs}
              engagementId={engagementId}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onPromoted={handlePromoted}
            />
          ))}
        </div>
      )}

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {showArchived
            ? `Hide ${archivedCount} archived`
            : `Show ${archivedCount} archived`}
        </button>
      )}
    </div>
  )
}
