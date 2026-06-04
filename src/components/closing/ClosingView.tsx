"use client"

import { useState, useMemo } from "react"
import { ObservationCard } from "@/components/capture/ObservationCard"
import { Button } from "@/components/ui/button"
import { SeverityBadge } from "@/components/findings/SeverityBadge"
import { BookOpen } from "lucide-react"

interface Observation {
  id: string
  content: string
  source: string
  host: string | null | undefined
  status: string
  createdAt: string
  engagementId: string
}

interface ConfirmedFinding {
  id: string
  title: string
  severity: string
}

interface Props {
  engagementId: string
  observations: Observation[]
  confirmedFindings: ConfirmedFinding[]
}

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  )
}

function similarity(a: string, b: string): number {
  const ta = tokenise(a)
  const tb = tokenise(b)
  const intersection = new Set([...ta].filter((x) => tb.has(x)))
  const union = new Set([...ta, ...tb])
  return union.size === 0 ? 0 : intersection.size / union.size
}

export function ClosingView({ engagementId, observations, confirmedFindings }: Props) {
  const [obs, setObs] = useState(observations)

  const grouped = useMemo(() => {
    if (confirmedFindings.length === 0) {
      return [{ finding: null, observations: obs }]
    }

    const findingGroups: Record<string, Observation[]> = { __unmatched: [] }

    for (const o of obs) {
      let bestMatch: string | null = null
      let bestScore = 0.15

      for (const f of confirmedFindings) {
        const score = similarity(o.content, f.title)
        if (score > bestScore) {
          bestScore = score
          bestMatch = f.id
        }
      }

      const key = bestMatch ?? "__unmatched"
      if (!findingGroups[key]) findingGroups[key] = []
      findingGroups[key].push(o)
    }

    const result: { finding: ConfirmedFinding | null; observations: Observation[] }[] = []
    for (const [key, items] of Object.entries(findingGroups)) {
      if (items.length === 0) continue
      const id = key === "__unmatched" ? null : key
      const finding = id ? confirmedFindings.find((f) => f.id === id) ?? null : null
      result.push({ finding, observations: items })
    }

    return result.sort((a, b) => {
      if (!a.finding) return 1
      if (!b.finding) return -1
      return 0
    })
  }, [obs, confirmedFindings])

  async function archiveAll() {
    const ids = obs.map((o) => o.id)
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/observations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        })
      )
    )
    setObs([])
  }

  function handleArchive(id: string) {
    setObs((prev) => prev.filter((o) => o.id !== id))
  }

  function handlePromoted(id: string) {
    setObs((prev) => prev.filter((o) => o.id !== id))
  }

  if (obs.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">All observations triaged</p>
        <p className="text-sm mt-1">Nothing left to review.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {obs.length} observation{obs.length !== 1 ? "s" : ""} to triage
        </p>
        <Button variant="outline" size="sm" onClick={archiveAll}>
          Archive all
        </Button>
      </div>

      <div className="space-y-6">
        {grouped.map(({ finding, observations: groupObs }, i) => (
          <div key={i}>
            {finding ? (
              <div className="flex items-center gap-2 mb-2">
                <SeverityBadge severity={finding.severity} />
                <span className="text-sm font-medium text-muted-foreground">
                  Similar to: {finding.title}
                </span>
              </div>
            ) : (
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Unmatched observations
              </p>
            )}
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              {groupObs.map((o) => (
                <ObservationCard
                  key={o.id}
                  observation={o}
                  engagementId={engagementId}
                  onArchive={handleArchive}
                  onPromoted={handlePromoted}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
