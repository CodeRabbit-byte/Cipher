"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "./SeverityBadge"
import { ChevronDown, ChevronUp } from "lucide-react"

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
  source: string
  createdAt: string
  mitreIds?: string | null
  mitreMitigations?: string | null
  sspControls?: string | null
  taConfidence?: number | null
  attackPath?: string | null
}

interface Props {
  finding: Finding
  onDelete?: (id: string) => void
}

function splitIds(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}

function sspLevel(control: string): "L0" | "L1" | "L2" | null {
  if (control.includes("L0")) return "L0"
  if (control.includes("L1")) return "L1"
  if (control.includes("L2")) return "L2"
  return null
}

function SspBadge({ control }: { control: string }) {
  const level = sspLevel(control)
  const colour =
    level === "L0"
      ? "border-red-400 text-red-700 bg-red-50"
      : level === "L1"
      ? "border-amber-400 text-amber-700 bg-amber-50"
      : "border-slate-300 text-slate-600 bg-slate-50"
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-mono font-medium ${colour}`}
      title={
        level === "L0"
          ? "Cardinal — mandatory, cannot defer without executive sign-off"
          : level === "L1"
          ? "Basic Hygiene — strongly recommended"
          : "Best Practice — risk-accepted deferral possible"
      }
    >
      {control}
    </span>
  )
}

function ConfidencePill({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const colour =
    pct >= 80
      ? "text-green-700 bg-green-50 border-green-300"
      : pct >= 60
      ? "text-amber-700 bg-amber-50 border-amber-300"
      : "text-red-700 bg-red-50 border-red-300"
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${colour}`}
      title="ThreatAssessor predicted confidence"
    >
      TA {pct}%
    </span>
  )
}

export function FindingCard({ finding, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)

  const mitreIds = splitIds(finding.mitreIds)
  const sspControls = splitIds(finding.sspControls)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={finding.severity} />
              <span className="font-medium text-sm">{finding.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              {finding.host && (
                <span className="font-mono">
                  {finding.host}
                  {finding.port ? `:${finding.port}` : ""}
                </span>
              )}
              {finding.cvss != null && (
                <span>CVSS {finding.cvss.toFixed(1)}</span>
              )}
              {finding.cveIds && (
                <span className="text-blue-600">{finding.cveIds}</span>
              )}
              <span className="capitalize">{finding.source}</span>
              {finding.taConfidence != null && (
                <ConfidencePill score={finding.taConfidence} />
              )}
            </div>

            {/* MITRE ATT&CK technique badges */}
            {mitreIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {mitreIds.map((id) => (
                  <Badge
                    key={id}
                    variant="outline"
                    className="text-[10px] font-mono px-1.5 py-0 border-purple-300 text-purple-700 bg-purple-50"
                  >
                    {id}
                  </Badge>
                ))}
              </div>
            )}

            {/* SSP control badges */}
            {sspControls.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {sspControls.map((c) => (
                  <SspBadge key={c} control={c} />
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 border-t">
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">{finding.description}</p>
            </div>
            {finding.attackPath && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Attack Path</p>
                <p className="text-sm font-mono text-muted-foreground">{finding.attackPath}</p>
              </div>
            )}
            {finding.remediationNote && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Remediation</p>
                <p className="text-sm whitespace-pre-wrap">{finding.remediationNote}</p>
              </div>
            )}
            {onDelete && (
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(finding.id)}
                >
                  Delete finding
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
