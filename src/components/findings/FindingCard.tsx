"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SeverityBadge } from "./SeverityBadge"
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react"

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
}

interface Props {
  finding: Finding
  onDelete?: (id: string) => void
}

export function FindingCard({ finding, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={finding.severity} />
              <span className="font-medium text-sm">{finding.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
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
            </div>
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
