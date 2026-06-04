"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { SummaryEditor } from "./SummaryEditor"
import type { ReportExportProps } from "./ReportExport"

const ReportExport = dynamic<ReportExportProps>(
  () => import("./ReportExport").then((m) => ({ default: m.ReportExport })),
  { ssr: false }
)
import { FindingChainMap } from "@/components/findings/FindingChainMap"
import { SeverityBadge } from "@/components/findings/SeverityBadge"
import type { FindingChainLink } from "@/types"
import { Wand2, AlertTriangle } from "lucide-react"

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
  engagementName: string
  clientName: string
  findings: Finding[]
}

export function ReportPage({ engagementId, engagementName, clientName, findings }: Props) {
  const [summary, setSummary] = useState("")
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState("")
  const [chains, setChains] = useState<FindingChainLink[]>([])

  async function handleDraft() {
    setDrafting(true)
    setError("")

    const res = await fetch("/api/ai/draft-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementId, findingChain: chains }),
    })

    setDrafting(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data.unconfigured) {
        setError(
          "AI drafting is not configured. Add an API key to your .env file and set AI_PROVIDER."
        )
      } else {
        setError(data.error ?? "Failed to generate summary")
      }
      return
    }

    const data = await res.json()
    setSummary(data.text)
  }

  const criticalAndHigh = findings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  )

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Finding summary</h2>
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed findings yet.</p>
        ) : (
          <div className="space-y-1.5">
            {findings.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-sm">
                <SeverityBadge severity={f.severity} />
                <span>{f.title}</span>
                {f.host && (
                  <span className="text-muted-foreground text-xs font-mono">{f.host}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {chains.length > 0 && (
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Finding chains</h2>
          <FindingChainMap
            findings={findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity }))}
            chains={chains}
          />
        </div>
      )}

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Executive summary</h2>
          <div className="flex items-center gap-2">
            <ReportExport
              engagementName={engagementName}
              clientName={clientName}
              summary={summary}
              findings={findings}
            />
            <Button
              size="sm"
              onClick={handleDraft}
              disabled={drafting || findings.length === 0}
              className="gap-1.5"
            >
              <Wand2 className="h-4 w-4" />
              {drafting ? "Drafting…" : summary ? "Redraft" : "Draft with AI"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        <SummaryEditor value={summary} onChange={setSummary} />
      </div>
    </div>
  )
}
