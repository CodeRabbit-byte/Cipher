"use client"

import { useState } from "react"
import { FindingCard } from "./FindingCard"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { NewFindingDialog } from "./NewFindingDialog"

interface Finding {
  id: string
  title: string
  description: string
  severity: string
  host: string | null | undefined
  port: number | null | undefined
  cvss: number | null | undefined
  cveIds: string | null | undefined
  remediationNote: string | null | undefined
  evidence: string | null | undefined
  source: string
  engagementId: string
  createdAt: string
  updatedAt: string
}

interface Props {
  engagementId: string
  initialFindings: Finding[]
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]

export function FindingsList({ engagementId, initialFindings }: Props) {
  const [findings, setFindings] = useState(initialFindings)
  const [newOpen, setNewOpen] = useState(false)

  function handleDelete(id: string) {
    fetch(`/api/findings/${id}`, { method: "DELETE" })
    setFindings((prev) => prev.filter((f) => f.id !== id))
  }

  function handleCreated(finding: Record<string, unknown>) {
    setFindings((prev) =>
      [...prev, finding as unknown as Finding].sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      )
    )
    setNewOpen(false)
  }

  const grouped = SEVERITY_ORDER.reduce<Record<string, Finding[]>>((acc, sev) => {
    const items = findings.filter((f) => f.severity === sev)
    if (items.length) acc[sev] = items
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New finding
        </Button>
      </div>

      {findings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No findings yet. Promote observations or add manually.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([sev, items]) => (
            <div key={sev}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">
                {sev} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((f) => (
                  <FindingCard key={f.id} finding={f} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <NewFindingDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        engagementId={engagementId}
        onCreated={handleCreated}
      />
    </div>
  )
}
