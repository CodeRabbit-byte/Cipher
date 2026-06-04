"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { SeverityBadge } from "./SeverityBadge"
import { Button } from "@/components/ui/button"
import { Search, BookMarked } from "lucide-react"
import { useRouter } from "next/navigation"

interface LibraryFinding {
  id: string
  title: string
  description: string
  severity: string
  host: string | null | undefined
  cveIds: string | null | undefined
  remediationNote: string | null | undefined
  source: string
  engagementId: string
  engagementName: string
  clientName: string
  createdAt: string
}

interface Props {
  findings: LibraryFinding[]
}

export function LibrarySearch({ findings }: Props) {
  const [query, setQuery] = useState("")
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return findings.filter((f) => {
      const matchQuery =
        !q ||
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.cveIds ?? "").toLowerCase().includes(q) ||
        (f.host ?? "").toLowerCase().includes(q) ||
        f.engagementName.toLowerCase().includes(q)

      const matchSeverity = !severityFilter || f.severity === severityFilter

      return matchQuery && matchSeverity
    })
  }, [findings, query, severityFilter])

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, description, CVE, host…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {["critical", "high", "medium", "low", "info"].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
              className={`text-xs px-2.5 py-1 rounded-full capitalize border transition-colors ${
                severityFilter === sev
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        {filtered.length} finding{filtered.length !== 1 ? "s" : ""}
        {query || severityFilter ? " (filtered)" : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No findings match your search.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <LibraryFindingRow key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  )
}

function LibraryFindingRow({ finding }: { finding: LibraryFinding }) {
  const [copied, setCopied] = useState(false)

  function useAsTemplate() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "finding-template",
        JSON.stringify({
          title: finding.title,
          description: finding.description,
          remediationNote: finding.remediationNote,
        })
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="border rounded-lg p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={finding.severity} />
          <span className="font-medium text-sm">{finding.title}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{finding.engagementName}</span>
          <span>·</span>
          <span>{finding.clientName}</span>
          {finding.cveIds && (
            <>
              <span>·</span>
              <span className="text-blue-600">{finding.cveIds}</span>
            </>
          )}
          <span>·</span>
          <span>{new Date(finding.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1"
        onClick={useAsTemplate}
      >
        <BookMarked className="h-3 w-3" />
        {copied ? "Copied!" : "Use as template"}
      </Button>
    </div>
  )
}
