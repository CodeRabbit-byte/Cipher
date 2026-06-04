"use client"

import { useState, useCallback } from "react"
import { IngestDropzone } from "./IngestDropzone"
import { DeduplicationDialog } from "./DeduplicationDialog"
import { Button } from "@/components/ui/button"
import { SeverityBadge } from "@/components/findings/SeverityBadge"
import type { ParsedFinding, DuplicateCandidate, DeduplicationDecision } from "@/types"
import { findDuplicateCandidates } from "@/lib/dedup/findings"
import type { Finding } from "@/types"
import { CheckCircle, AlertCircle } from "lucide-react"

interface ExistingFinding {
  id: string
  title: string
  description: string
  severity: string
  host: string | null
  port: number | null
}

interface Props {
  engagementId: string
  existingFindings: ExistingFinding[]
}

type IngestState =
  | { phase: "idle" }
  | { phase: "preview"; findings: ParsedFinding[]; warnings: string[]; source: string }
  | { phase: "dedup"; queue: DuplicateCandidate[]; resolved: DeduplicationDecision[]; clean: ParsedFinding[] }
  | { phase: "importing"; total: number; done: number }
  | { phase: "done"; imported: number; skipped: number }

export function IngestPage({ engagementId, existingFindings }: Props) {
  const [state, setState] = useState<IngestState>({ phase: "idle" })

  async function handleFileDrop(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase()
    let endpoint = ""
    let source = ""

    if (ext === "xml" && file.name.toLowerCase().includes("burp")) {
      endpoint = "/api/ingest/burp"
      source = "Burp Suite"
    } else if (ext === "xml") {
      const text = await file.text()
      if (text.includes("<nmaprun")) {
        endpoint = "/api/ingest/nmap"
        source = "nmap"
      } else if (text.includes("<issues>") || text.includes("<BurpVersion>")) {
        endpoint = "/api/ingest/burp"
        source = "Burp Suite"
      } else if (/<MetasploitV[45]/i.test(text)) {
        endpoint = "/api/ingest/metasploit"
        source = "Metasploit"
      } else {
        endpoint = "/api/ingest/nmap"
        source = "XML"
      }
    } else if (ext === "json") {
      endpoint = "/api/ingest/nuclei"
      source = "Nuclei"
    } else if (ext === "nessus") {
      endpoint = "/api/ingest/nessus"
      source = "Nessus"
    } else {
      alert("Unsupported file type. Use .xml (Burp / nmap / Metasploit), .json (Nuclei), or .nessus")
      return
    }

    const text = await file.text()
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: text,
    })

    if (!res.ok) {
      alert("Failed to parse file")
      return
    }

    const { findings, parseWarnings } = await res.json()
    setState({ phase: "preview", findings, warnings: parseWarnings, source })
  }

  function handleProceedToDedup() {
    if (state.phase !== "preview") return
    const candidates = findDuplicateCandidates(
      state.findings,
      existingFindings as unknown as Finding[]
    )
    const candidateKeys = new Set(candidates.map((c) => c.incoming.title + c.incoming.host))
    const clean = state.findings.filter(
      (f) => !candidateKeys.has(f.title + (f.host ?? ""))
    )

    if (candidates.length === 0) {
      void importFindings(clean, [])
      return
    }

    setState({ phase: "dedup", queue: candidates, resolved: [], clean })
  }

  function handleDedupDecision(decisions: DeduplicationDecision[]) {
    if (state.phase !== "dedup") return
    void importFindings(state.clean, decisions)
  }

  async function importFindings(clean: ParsedFinding[], decisions: DeduplicationDecision[]) {
    const toImport: ParsedFinding[] = [...clean]

    for (const d of decisions) {
      if (d.action === "keep_both" || d.action === "mark_distinct") {
        toImport.push(d.candidate.incoming)
      } else if (d.action === "merge") {
        const higher =
          ["critical", "high", "medium", "low", "info"].indexOf(d.candidate.incoming.severity) <
          ["critical", "high", "medium", "low", "info"].indexOf(d.candidate.existing.severity)
            ? d.candidate.incoming.severity
            : d.candidate.existing.severity

        await fetch(`/api/findings/${d.candidate.existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            severity: higher,
            evidence: [d.candidate.existing.evidence, d.candidate.incoming.evidence]
              .filter(Boolean)
              .join("\n"),
          }),
        })
      }
    }

    setState({ phase: "importing", total: toImport.length, done: 0 })

    let done = 0
    let skipped = 0
    for (const f of toImport) {
      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, engagementId }),
      })
      if (res.ok) done++
      else skipped++
      setState({ phase: "importing", total: toImport.length, done: done + skipped })
    }

    setState({ phase: "done", imported: done, skipped })
  }

  if (state.phase === "done") {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <p className="font-medium text-lg">Import complete</p>
        <p className="text-muted-foreground text-sm mt-1">
          {state.imported} finding{state.imported !== 1 ? "s" : ""} imported
          {state.skipped > 0 && `, ${state.skipped} failed`}
        </p>
        <Button className="mt-4" onClick={() => setState({ phase: "idle" })}>
          Import more
        </Button>
      </div>
    )
  }

  if (state.phase === "importing") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="font-medium">Importing…</p>
        <p className="text-sm mt-1">
          {state.done} / {state.total}
        </p>
      </div>
    )
  }

  if (state.phase === "dedup") {
    return (
      <DeduplicationDialog
        candidates={state.queue}
        onDecide={handleDedupDecision}
        onCancel={() => setState({ phase: "idle" })}
      />
    )
  }

  if (state.phase === "preview") {
    const { findings, warnings, source } = state
    const severityCounts = findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1
      return acc
    }, {})

    return (
      <div>
        <div className="mb-4">
          <p className="font-medium text-sm">
            {findings.length} finding{findings.length !== 1 ? "s" : ""} detected from {source}
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {Object.entries(severityCounts).map(([sev, count]) => (
              <span key={sev} className="flex items-center gap-1 text-xs">
                <SeverityBadge severity={sev} />
                <span className="text-muted-foreground">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-md border border-amber-200 bg-amber-50">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-medium mb-1">
              <AlertCircle className="h-4 w-4" />
              Parse warnings ({warnings.length})
            </div>
            <ul className="space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border rounded-lg divide-y mb-4 max-h-80 overflow-y-auto">
          {findings.map((f, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-3">
              <SeverityBadge severity={f.severity} />
              <span className="text-sm flex-1 truncate">{f.title}</span>
              {f.host && (
                <span className="text-xs text-muted-foreground font-mono">{f.host}</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button onClick={handleProceedToDedup}>
            Import {findings.length} finding{findings.length !== 1 ? "s" : ""}
          </Button>
          <Button variant="outline" onClick={() => setState({ phase: "idle" })}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return <IngestDropzone onFileDrop={handleFileDrop} />
}
