"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { AlertTriangle, ArrowUpCircle } from "lucide-react"

interface Observation {
  id: string
  content: string
  source: string
  host: string | null | undefined
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  observation: Observation
  engagementId: string
  onPromoted: (observationId: string, findingId: string) => void
}

function inferTitle(content: string): string {
  const line = content.split("\n")[0].trim()
  return line.length > 120 ? line.slice(0, 120) + "…" : line
}

const SEVERITY_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  critical: { label: "Critical", dot: "bg-red-500",    text: "text-red-400" },
  high:     { label: "High",     dot: "bg-orange-500", text: "text-orange-400" },
  medium:   { label: "Medium",   dot: "bg-yellow-500", text: "text-yellow-400" },
  low:      { label: "Low",      dot: "bg-blue-400",   text: "text-blue-400" },
  info:     { label: "Info",     dot: "bg-slate-400",  text: "text-slate-400" },
}

export function PromoteDialog({ open, onOpenChange, observation, engagementId, onPromoted }: Props) {
  const [title, setTitle] = useState(() => inferTitle(observation.content))
  const [description, setDescription] = useState(observation.content)
  const [severity, setSeverity] = useState("medium")
  const [host, setHost] = useState(observation.host ?? "")
  const [remediationNote, setRemediationNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handlePromote() {
    if (!title.trim()) { setError("Title is required"); return }
    setSaving(true)
    setError("")

    const res = await fetch("/api/findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        severity,
        host: host.trim() || null,
        remediationNote: remediationNote.trim() || null,
        engagementId,
        observationIds: [observation.id],
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Failed to promote")
      return
    }

    const finding = await res.json()
    onPromoted(observation.id, finding.id)
    onOpenChange(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePromote()
  }

  const sev = SEVERITY_CONFIG[severity]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg flex flex-col gap-0 p-0 max-h-[90vh]"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-primary shrink-0" />
            <DialogTitle className="text-sm font-semibold">Promote to finding</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted border border-border font-mono">
              Ctrl+Enter
            </kbd>{" "}
            to save.
          </p>
        </DialogHeader>

        {/* Source preview */}
        <div className="px-5 py-2.5 bg-muted/40 border-b border-border shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            From observation
          </p>
          <p className="text-xs text-foreground/70 line-clamp-2 leading-relaxed">
            {observation.content}
          </p>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="promote-title" className="text-xs font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="promote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm h-8"
              autoFocus
            />
          </div>

          {/* Severity + Host */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="text-sm h-8">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />
                    <span className={sev.text}>{sev.label}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className={cfg.text}>{cfg.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promote-host" className="text-xs font-medium">Host</Label>
              <Input
                id="promote-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="app.example.com"
                className="text-sm h-8"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="promote-desc" className="text-xs font-medium">Description</Label>
            <Textarea
              id="promote-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Remediation */}
          <div className="space-y-1.5">
            <Label htmlFor="promote-remediation" className="text-xs font-medium">
              Remediation note{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="promote-remediation"
              value={remediationNote}
              onChange={(e) => setRemediationNote(e.target.value)}
              rows={2}
              placeholder="Recommended fix or mitigation…"
              className="text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handlePromote} disabled={saving} className="gap-1.5">
            <ArrowUpCircle className="w-3.5 h-3.5" />
            {saving ? "Promoting…" : "Promote to finding"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
