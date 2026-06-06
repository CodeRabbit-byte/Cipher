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

interface TaObservation {
  id: string
  content: string
  status: string
  mitreIds: string | null | undefined
  attackPath: string | null | undefined
}

interface Props {
  engagementId: string
  observations: Observation[]
  confirmedFindings: ConfirmedFinding[]
  taObservations?: TaObservation[]
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

function CoverageBar({ score }: { score: number }) {
  const colour =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"
  const textColour =
    score >= 70 ? "text-green-700" : score >= 40 ? "text-amber-700" : "text-red-700"
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colour}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-semibold tabular-nums ${textColour}`}>{score}%</span>
    </div>
  )
}

function firstLine(content: string): string {
  const line = content.split("\n")[0].replace(/^\[.*?\]\s*/, "").trim()
  return line.length > 80 ? line.slice(0, 80) + "…" : line
}

export function ClosingView({ engagementId, observations, confirmedFindings, taObservations = [] }: Props) {
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

  function handleDelete(id: string) {
    setObs((prev) => prev.filter((o) => o.id !== id))
  }

  function handlePromoted(id: string, _findingId: string) {
    setObs((prev) => prev.filter((o) => o.id !== id))
  }

  // ── ThreatAssessor coverage score ─────────────────────────────────────────
  const confirmed = taObservations.filter((o) => o.status === "promoted")
  const archived = taObservations.filter((o) => o.status === "archived")
  const notTested = taObservations.filter((o) => o.status === "raw")
  const total = taObservations.length
  const coverageScore = total > 0 ? Math.round((confirmed.length / total) * 100) : null

  return (
    <div>
      {/* ── Threat Model Coverage ─────────────────────────────────────────── */}
      {total > 0 && (
        <div className="mb-8 rounded-lg border p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-1">Threat Model Coverage</h2>
            <p className="text-xs text-muted-foreground">
              {confirmed.length} of {total} predicted attack path{total !== 1 ? "s" : ""} confirmed during testing
            </p>
          </div>

          {coverageScore !== null && <CoverageBar score={coverageScore} />}

          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            {/* Confirmed */}
            <div>
              <p className="font-medium text-green-700 mb-1.5">
                Confirmed ({confirmed.length})
              </p>
              {confirmed.length === 0 ? (
                <p className="text-muted-foreground">None yet</p>
              ) : (
                <ul className="space-y-1">
                  {confirmed.map((o) => (
                    <li key={o.id} className="flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span className="text-foreground/80">
                        {firstLine(o.content)}
                        {o.mitreIds && (
                          <span className="ml-1 text-purple-600 font-mono">
                            [{o.mitreIds.split(",")[0]}]
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Not Tested */}
            <div>
              <p className="font-medium text-amber-700 mb-1.5">
                Not Tested ({notTested.length})
              </p>
              {notTested.length === 0 ? (
                <p className="text-muted-foreground">All paths triaged</p>
              ) : (
                <ul className="space-y-1">
                  {notTested.map((o) => (
                    <li key={o.id} className="flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span className="text-foreground/80">
                        {firstLine(o.content)}
                        {o.mitreIds && (
                          <span className="ml-1 text-purple-600 font-mono">
                            [{o.mitreIds.split(",")[0]}]
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {notTested.length > 0 && (
                <p className="mt-2 text-muted-foreground">
                  Archive before closing to acknowledge them.
                </p>
              )}
            </div>

            {/* Archived */}
            <div>
              <p className="font-medium text-muted-foreground mb-1.5">
                Archived / Out of Scope ({archived.length})
              </p>
              {archived.length === 0 ? (
                <p className="text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1">
                  {archived.map((o) => (
                    <li key={o.id} className="flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span className="text-foreground/60">{firstLine(o.content)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-3">
            Unconfirmed paths do not mean they are safe — they mean they were not tested.
          </p>
        </div>
      )}

      {/* ── Untriaged observations ─────────────────────────────────────────── */}
      {obs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">All observations triaged</p>
          <p className="text-sm mt-1">Nothing left to review.</p>
        </div>
      ) : (
        <>
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
                      onDelete={handleDelete}
                      onPromoted={handlePromoted}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
