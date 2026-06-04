"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  SelectValue,
} from "@/components/ui/select"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  engagementId: string
  onCreated: (finding: Record<string, unknown>) => void
  prefill?: {
    title?: string
    description?: string
    remediationNote?: string
  }
}

export function NewFindingDialog({ open, onOpenChange, engagementId, onCreated, prefill }: Props) {
  const [title, setTitle] = useState(prefill?.title ?? "")
  const [description, setDescription] = useState(prefill?.description ?? "")
  const [severity, setSeverity] = useState("medium")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("")
  const [cveIds, setCveIds] = useState("")
  const [remediationNote, setRemediationNote] = useState(prefill?.remediationNote ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("Title is required"); return }
    if (!description.trim()) { setError("Description is required"); return }
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
        port: port ? parseInt(port, 10) : null,
        cveIds: cveIds.trim() || null,
        remediationNote: remediationNote.trim() || null,
        engagementId,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "Failed to create finding")
      return
    }

    const finding = await res.json()
    onCreated(finding)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New finding</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nf-title">Title *</Label>
            <Input id="nf-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf-host">Host</Label>
              <Input id="nf-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="host or IP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf-port">Port</Label>
              <Input id="nf-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="e.g. 443" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nf-desc">Description *</Label>
            <Textarea id="nf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nf-remediation">Remediation note</Label>
            <Textarea id="nf-remediation" value={remediationNote} onChange={(e) => setRemediationNote(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nf-cve">CVE IDs</Label>
            <Input id="nf-cve" value={cveIds} onChange={(e) => setCveIds(e.target.value)} placeholder="CVE-2024-1234, CVE-2024-5678" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create finding"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
