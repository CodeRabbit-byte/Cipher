"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { IngestDropzone } from "./IngestDropzone"
import { DeduplicationDialog } from "./DeduplicationDialog"
import { Button } from "@/components/ui/button"
import { SeverityBadge } from "@/components/findings/SeverityBadge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { ParsedFinding, DuplicateCandidate, DeduplicationDecision } from "@/types"
import { findDuplicateCandidates } from "@/lib/dedup/findings"
import type { Finding } from "@/types"
import { CheckCircle, AlertCircle, Upload, Loader2 } from "lucide-react"
import { SSP_PROFILE_LABELS, SSP_PROFILES } from "@/lib/parsers/threatassessor"
import type { TAParsedFinding } from "@/lib/parsers/threatassessor"

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

// "finding" = normal ingest (creates Finding records)
// "observation" = ThreatAssessor ingest (creates Observation records)
type ImportMode = "finding" | "observation"

type IngestState =
  | { phase: "idle" }
  | {
      phase: "preview"
      findings: ParsedFinding[]
      warnings: string[]
      source: string
      importMode: ImportMode
    }
  | {
      phase: "dedup"
      queue: DuplicateCandidate[]
      resolved: DeduplicationDecision[]
      clean: ParsedFinding[]
      importMode: ImportMode
    }
  | { phase: "importing"; total: number; done: number }
  | { phase: "done"; imported: number; skipped: number; importMode: ImportMode }

// Rotating status messages shown during ThreatAssessor analysis
const TA_MESSAGES = [
  "Parsing architecture diagram…",
  "Mapping MITRE ATT&CK techniques…",
  "Tracing attack paths…",
  "Scoring residual risk…",
  "Finalising threat predictions…",
]
const TA_MESSAGES_FULL = [
  ...TA_MESSAGES,
  "Running Architect critic…",
  "Running Tester critic…",
  "Running Red Team critic…",
  "Building MoE consensus…",
]

export function IngestPage({ engagementId, existingFindings }: Props) {
  const [state, setState] = useState<IngestState>({ phase: "idle" })
  const [activeTab, setActiveTab] = useState("tools")

  // ThreatAssessor tab state
  const [sspProfile, setSspProfile] = useState("medium_risk_cloud")
  const [taMode, setTaMode] = useState("fast")
  const [taFile, setTaFile] = useState<File | null>(null)
  const [taDragging, setTaDragging] = useState(false)
  const [taLoading, setTaLoading] = useState(false)
  const [taError, setTaError] = useState<string | null>(null)
  const [taMessage, setTaMessage] = useState(TA_MESSAGES[0])
  const [taConfigured, setTaConfigured] = useState<boolean | null>(null)
  const taMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taMessageIndexRef = useRef(0)

  // Check ThreatAssessor configuration on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ingest/threatassessor/configured")
        if (res.ok) {
          const data = await res.json()
          setTaConfigured(data.configured === true)
        } else {
          setTaConfigured(false)
        }
      } catch {
        setTaConfigured(false)
      }
    })()
  }, [])

  function startTaMessageRotation(fullMode: boolean) {
    const messages = fullMode ? TA_MESSAGES_FULL : TA_MESSAGES
    taMessageIndexRef.current = 0
    setTaMessage(messages[0])

    function next() {
      taMessageIndexRef.current = (taMessageIndexRef.current + 1) % messages.length
      setTaMessage(messages[taMessageIndexRef.current])
      taMessageTimerRef.current = setTimeout(next, 8000)
    }
    taMessageTimerRef.current = setTimeout(next, 8000)
  }

  function stopTaMessageRotation() {
    if (taMessageTimerRef.current) {
      clearTimeout(taMessageTimerRef.current)
      taMessageTimerRef.current = null
    }
  }

  // ── Existing tools tab ─────────────────────────────────────────────────────

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
    setState({ phase: "preview", findings, warnings: parseWarnings, source, importMode: "finding" })
  }

  // ── ThreatAssessor tab ─────────────────────────────────────────────────────

  const handleTaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setTaDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      if (!file.name.endsWith(".mmd")) {
        setTaError("Only .mmd (Mermaid diagram) files are accepted.")
        return
      }
      setTaFile(file)
      setTaError(null)
    }
  }, [])

  function handleTaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith(".mmd")) {
        setTaError("Only .mmd (Mermaid diagram) files are accepted.")
        return
      }
      setTaFile(file)
      setTaError(null)
    }
  }

  async function handleTaSubmit() {
    if (!taFile) {
      setTaError("Please select a .mmd architecture diagram.")
      return
    }
    setTaLoading(true)
    setTaError(null)
    startTaMessageRotation(taMode === "full")

    const form = new FormData()
    form.append("architecture_file", taFile, taFile.name)
    form.append("ssp_profile", sspProfile)
    form.append("mode", taMode)
    form.append("engagement_id", engagementId)

    try {
      const res = await fetch("/api/ingest/threatassessor", {
        method: "POST",
        body: form,
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 503 && data.error?.includes("not configured")) {
          setTaConfigured(false)
        }
        setTaError(statusToMessage(res.status, data.error ?? "Unknown error"))
        return
      }

      const { findings, parseWarnings } = data as { findings: ParsedFinding[]; parseWarnings: string[] }
      setState({
        phase: "preview",
        findings,
        warnings: parseWarnings,
        source: "ThreatAssessor",
        importMode: "observation",
      })
    } catch {
      setTaError("Network error — could not reach the CIPHER server.")
    } finally {
      stopTaMessageRotation()
      setTaLoading(false)
    }
  }

  function statusToMessage(status: number, detail: string): string {
    if (status === 503 && detail.includes("not configured")) {
      return detail
    }
    if (status === 503) return `Cannot reach ThreatAssessor. Is it running? (${detail})`
    if (status === 429) return "ThreatAssessor rate limit reached (10 req/min). Wait a moment and try again."
    if (status === 504) return "Analysis timed out. Try fast mode, or check ThreatAssessor is healthy."
    if (status === 400) return detail
    if (status === 502) return `ThreatAssessor returned an error: ${detail}`
    return detail
  }

  // ── Dedup flow ─────────────────────────────────────────────────────────────

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
      void importItems(clean, [], state.importMode)
      return
    }

    setState({
      phase: "dedup",
      queue: candidates,
      resolved: [],
      clean,
      importMode: state.importMode,
    })
  }

  function handleDedupDecision(decisions: DeduplicationDecision[]) {
    if (state.phase !== "dedup") return
    void importItems(state.clean, decisions, state.importMode)
  }

  // ── Import: findings (existing tools) ─────────────────────────────────────

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

    setState({ phase: "done", imported: done, skipped, importMode: "finding" })
  }

  // ── Import: observations (ThreatAssessor) ─────────────────────────────────
  // Predicted attack paths are stored as raw observations so the pentester can:
  //   - promote them when confirmed during the engagement
  //   - archive them if out of scope / accepted risk
  //   - leave them untested (shows up in closing coverage score)

  async function importTaObservations(clean: ParsedFinding[], decisions: DeduplicationDecision[]) {
    const toObserve: ParsedFinding[] = [...clean]

    for (const d of decisions) {
      if (d.action === "keep_both" || d.action === "mark_distinct") {
        toObserve.push(d.candidate.incoming)
      } else if (d.action === "merge") {
        // Merge: patch the existing confirmed finding with TA fields
        const ta = d.candidate.incoming as TAParsedFinding
        const higher =
          ["critical", "high", "medium", "low", "info"].indexOf(ta.severity) <
          ["critical", "high", "medium", "low", "info"].indexOf(d.candidate.existing.severity)
            ? ta.severity
            : d.candidate.existing.severity

        await fetch(`/api/findings/${d.candidate.existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            severity: higher,
            mitreIds: ta.mitreIds ?? undefined,
            mitreMitigations: ta.mitreMitigations ?? undefined,
            sspControls: ta.sspControls ?? undefined,
            taConfidence: ta.taConfidence ?? undefined,
            attackPath: ta.attackPath ?? undefined,
          }),
        })
      }
    }

    setState({ phase: "importing", total: toObserve.length, done: 0 })

    let done = 0
    let skipped = 0
    for (const f of toObserve) {
      const ta = f as TAParsedFinding
      // Build observation content: severity + title + attack path + description
      const content = [
        `[${f.severity.toUpperCase()}] ${f.title}`,
        ta.attackPath ? `Attack path: ${ta.attackPath}` : null,
        f.description,
      ]
        .filter(Boolean)
        .join("\n\n")

      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.slice(0, 10000),
          engagementId,
          host: f.host ?? null,
          source: "threatassessor",
          mitreIds: ta.mitreIds ?? null,
          mitreMitigations: ta.mitreMitigations ?? null,
          sspControls: ta.sspControls ?? null,
          taConfidence: ta.taConfidence ?? null,
          attackPath: ta.attackPath ?? null,
        }),
      })
      if (res.ok) done++
      else skipped++
      setState({ phase: "importing", total: toObserve.length, done: done + skipped })
    }

    setState({ phase: "done", imported: done, skipped, importMode: "observation" })
  }

  function importItems(
    clean: ParsedFinding[],
    decisions: DeduplicationDecision[],
    importMode: ImportMode
  ) {
    if (importMode === "observation") {
      return importTaObservations(clean, decisions)
    }
    return importFindings(clean, decisions)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state.phase === "done") {
    const isTA = state.importMode === "observation"
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <p className="font-medium text-lg">Import complete</p>
        <p className="text-muted-foreground text-sm mt-1">
          {state.imported} {isTA ? "predicted path" : "finding"}{state.imported !== 1 ? "s" : ""}{" "}
          {isTA ? "saved as observations" : "imported"}
          {state.skipped > 0 && `, ${state.skipped} failed`}
        </p>
        {isTA && (
          <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
            Predicted paths are now in your Observations feed. Promote them to findings
            as you confirm them during testing.
          </p>
        )}
        <Button className="mt-4" onClick={() => { setState({ phase: "idle" }); setTaFile(null) }}>
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
            {findings.length} {state.importMode === "observation" ? "predicted attack path" : "finding"}
            {findings.length !== 1 ? "s" : ""} detected from {source}
          </p>
          {state.importMode === "observation" && (
            <p className="text-xs text-muted-foreground mt-1">
              These will be saved as raw observations. Promote them to findings as you confirm them.
            </p>
          )}
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
            {state.importMode === "observation" ? "Save" : "Import"} {findings.length}{" "}
            {state.importMode === "observation" ? "predicted path" : "finding"}
            {findings.length !== 1 ? "s" : ""}
          </Button>
          <Button variant="outline" onClick={() => { setState({ phase: "idle" }); setTaFile(null) }}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ── Idle: show tabs ────────────────────────────────────────────────────────
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="tools">Security Tools</TabsTrigger>
        <TabsTrigger value="threatassessor">Threat Model</TabsTrigger>
      </TabsList>

      <TabsContent value="tools">
        <IngestDropzone onFileDrop={handleFileDrop} />
      </TabsContent>

      <TabsContent value="threatassessor">
        {taConfigured === false ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">ThreatAssessor is not configured</p>
                <p className="text-xs text-amber-700 mt-1">
                  Add <code className="font-mono bg-amber-100 px-1 rounded">THREATASSESSOR_URL</code> and{" "}
                  <code className="font-mono bg-amber-100 px-1 rounded">THREATASSESSOR_API_KEY</code> to
                  your <code className="font-mono bg-amber-100 px-1 rounded">.env</code> file,
                  then restart the dev server.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* SSP Profile */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="ta-ssp">SSP Profile</Label>
                  <span
                    className="text-xs text-muted-foreground cursor-help"
                    title="The Singapore Government SSP deployment profile that applies to the client's environment. This determines which controls are mandatory (L0), recommended (L1), or best practice (L2)."
                  >
                    ⓘ
                  </span>
                </div>
                <Select value={sspProfile} onValueChange={setSspProfile}>
                  <SelectTrigger id="ta-ssp">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SSP_PROFILES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {SSP_PROFILE_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Analysis mode */}
              <div className="space-y-2">
                <Label>Analysis Mode</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTaMode("fast")}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                      taMode === "fast"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-input hover:border-primary/60"
                    }`}
                  >
                    <div className="font-medium">Fast</div>
                    <div className="text-xs text-muted-foreground">≈30 s · Deterministic RAPIDS</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaMode("full")}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                      taMode === "full"
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-input hover:border-primary/60"
                    }`}
                  >
                    <div className="font-medium">Full Review</div>
                    <div className="text-xs text-muted-foreground">≈2 min · Adds MoE critics</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Dropzone */}
            <label
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                taDragging
                  ? "border-primary bg-primary/5"
                  : taFile
                  ? "border-green-400 bg-green-50"
                  : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/10"
              }`}
              onDragEnter={() => setTaDragging(true)}
              onDragLeave={() => setTaDragging(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleTaDrop}
            >
              <input
                type="file"
                accept=".mmd"
                className="sr-only"
                onChange={handleTaFileChange}
              />
              <Upload className="h-8 w-8 text-muted-foreground mb-3" />
              {taFile ? (
                <>
                  <p className="text-sm font-medium text-green-700">{taFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to change file</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop your Mermaid architecture diagram here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    .mmd files only — export from mermaid.live or your diagramming tool
                  </p>
                </>
              )}
            </label>

            {taLoading && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">{taMessage}</p>
              </div>
            )}

            {taError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{taError}</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleTaSubmit}
              disabled={taLoading || !taFile}
              className="w-full"
            >
              {taLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analysing…
                </>
              ) : (
                "Analyse Architecture"
              )}
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
