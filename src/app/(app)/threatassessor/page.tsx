"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, AlertCircle, ChevronDown, ChevronRight, Shield, ShieldAlert, ShieldX, RotateCcw } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

interface AttackPath {
  id: string
  entry: string
  target: string
  path: string[]
  hop_count: number
  techniques: string[]
  rationale: string
}

interface RapidsEntry {
  risk: number
  defensibility: number
  rationale: string
}

interface GroundTruth {
  architecture: string
  description?: string
  controls_present: string[]
  controls_missing: string[]
  expected_attack_paths: AttackPath[]
  expected_risk_score: number
  expected_defensibility: number
  rapids_assessment: Record<string, RapidsEntry>
  rationale: string
  metadata: {
    architecture_type: string
    node_count: number
    edge_count: number
    control_coverage: number
  }
}

interface ReportSummary {
  name: string
  riskScore: number
  defensibility: number
  architectureType: string
  nodeCount: number
  attackPathCount: number
  controlCoverage: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

const RAPIDS_LABELS: Record<string, string> = {
  ransomware: "Ransomware",
  application_vulns: "App Vulnerabilities",
  phishing: "Phishing",
  insider_threat: "Insider Threat",
  dos: "Denial of Service",
  supply_chain: "Supply Chain",
}

function riskColour(score: number) {
  if (score >= 70) return "text-red-600"
  if (score >= 40) return "text-amber-600"
  return "text-green-600"
}

function riskBg(score: number) {
  if (score >= 70) return "bg-red-100 text-red-700"
  if (score >= 40) return "bg-amber-100 text-amber-700"
  return "bg-green-100 text-green-700"
}

function defBg(score: number) {
  if (score >= 60) return "bg-green-100 text-green-700"
  if (score >= 30) return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-700"
}

function ScoreBar({ value, colour }: { value: number; colour: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${value}%` }} />
    </div>
  )
}

function RiskBadge({ score }: { score: number }) {
  const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low"
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskBg(score)}`}>
      {label} {score}/100
    </span>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ReportView({ data, name }: { data: GroundTruth; name: string }) {
  const [expandedPath, setExpandedPath] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.metadata.architecture_type.replace(/_/g, " ")} ·{" "}
            {data.metadata.node_count} nodes · {data.metadata.edge_count} edges
          </p>
        </div>
        <RiskBadge score={data.expected_risk_score} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Risk Score",       value: `${data.expected_risk_score}/100`,                   sub: "Higher = worse",    icon: <ShieldX className="h-4 w-4 text-red-500" /> },
          { label: "Defensibility",    value: `${data.expected_defensibility}/100`,                sub: "Higher = better",   icon: <Shield className="h-4 w-4 text-green-500" /> },
          { label: "Attack Paths",     value: `${data.expected_attack_paths.length}`,              sub: "Identified",        icon: <ShieldAlert className="h-4 w-4 text-amber-500" /> },
          { label: "Control Coverage", value: `${Math.round(data.metadata.control_coverage * 100)}%`, sub: "Controls present", icon: <Shield className="h-4 w-4 text-blue-500" /> },
        ].map(c => (
          <div key={c.label} className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {c.icon}{c.label}
            </div>
            <p className={`text-xl font-bold ${c.label === "Risk Score" ? riskColour(data.expected_risk_score) : ""}`}>
              {c.value}
            </p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Rationale */}
      <p className="text-sm text-muted-foreground border-l-2 pl-3">{data.rationale}</p>

      {/* RAPIDS Assessment */}
      <div>
        <h3 className="text-sm font-semibold mb-2">RAPIDS Assessment</h3>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Category</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Risk</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Defensibility</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground hidden sm:table-cell">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(data.rapids_assessment).map(([key, val]) => (
                <tr key={key} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                    {RAPIDS_LABELS[key] ?? key.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${riskBg(val.risk)}`}>
                      {val.risk}
                    </span>
                    <ScoreBar value={val.risk} colour="bg-red-400" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${defBg(val.defensibility)}`}>
                      {val.defensibility}
                    </span>
                    <ScoreBar value={val.defensibility} colour="bg-green-400" />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                    {val.rationale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attack Paths */}
      {data.expected_attack_paths.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Attack Paths <span className="text-muted-foreground font-normal">({data.expected_attack_paths.length})</span>
          </h3>
          <div className="space-y-2">
            {data.expected_attack_paths.map(ap => (
              <div key={ap.id} className="rounded-lg border">
                <button
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedPath(expandedPath === ap.id ? null : ap.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{ap.id}</span>
                    <span className="text-sm font-medium truncate">
                      {ap.entry} → {ap.target}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{ap.hop_count} hops</span>
                  </div>
                  {expandedPath === ap.id
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                {expandedPath === ap.id && (
                  <div className="px-4 pb-3 border-t pt-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {ap.path.map((node, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">{node}</span>
                          {i < ap.path.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ap.techniques.map(t => (
                        <span key={t} className="text-xs font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{ap.rationale}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-green-700">
            Controls Present <span className="text-muted-foreground font-normal">({data.controls_present.length})</span>
          </h3>
          {data.controls_present.length === 0
            ? <p className="text-xs text-muted-foreground">None detected</p>
            : (
              <ul className="space-y-1">
                {data.controls_present.map(c => (
                  <li key={c} className="text-xs flex items-center gap-1.5">
                    <span className="text-green-500">✓</span> {c}
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 text-red-700">
            Controls Missing <span className="text-muted-foreground font-normal">({data.controls_missing.length})</span>
          </h3>
          {data.controls_missing.length === 0
            ? <p className="text-xs text-muted-foreground">No gaps detected</p>
            : (
              <ul className="space-y-1">
                {data.controls_missing.map(c => (
                  <li key={c} className="text-xs flex items-center gap-1.5">
                    <span className="text-red-500">✗</span> {c}
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ThreatAssessorPage() {
  const [file, setFile]       = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [result, setResult]     = useState<{ data: GroundTruth; name: string } | null>(null)
  const [reports, setReports]   = useState<ReportSummary[]>([])
  const [selectedReport, setSelectedReport] = useState<{ data: GroundTruth; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetch("/api/threatassessor/reports")
      .then(r => r.json())
      .then(d => setReports(d.reports ?? []))
      .catch(() => {})
  }, [result])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith(".mmd")) { setFile(f); setError(null) }
    else setError("Only .mmd Mermaid diagram files are accepted.")
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f?.name.endsWith(".mmd")) { setFile(f); setError(null) }
    else setError("Only .mmd Mermaid diagram files are accepted.")
  }

  async function handleAnalyse() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedReport(null)

    const form = new FormData()
    form.append("architecture_file", file, file.name)

    try {
      const res  = await fetch("/api/threatassessor/analyze", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Analysis failed."); return }
      setResult({ data: data.data, name: data.architectureName })
    } catch {
      setError("Network error — could not reach the CIPHER server.")
    } finally {
      setLoading(false)
    }
  }

  async function loadReport(name: string) {
    setResult(null)
    const res  = await fetch(`/api/threatassessor/reports/${name}`)
    const data = await res.json()
    if (res.ok) setSelectedReport({ data: data.data, name: data.architectureName })
  }

  const activeResult = result ?? selectedReport

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Threat Assessor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a Mermaid architecture diagram to get a deterministic MITRE ATT&CK threat assessment.
        </p>
      </div>

      {/* Upload + Analyse */}
      <div className="rounded-xl border p-5 space-y-4">
        <h2 className="text-sm font-semibold">New Analysis</h2>

        <label
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragging ? "border-primary bg-primary/5"
            : file   ? "border-green-400 bg-green-50"
            : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/10"
          }`}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mmd"
            className="sr-only"
            onChange={handleFileChange}
          />
          <Upload className="h-7 w-7 text-muted-foreground mb-2" />
          {file ? (
            <>
              <p className="text-sm font-medium text-green-700">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">Click to change file</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Drop your Mermaid architecture diagram here</p>
              <p className="text-xs text-muted-foreground mt-1">.mmd files only — export from mermaid.live</p>
            </>
          )}
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing architecture… (~30 s)
          </div>
        )}

        <Button onClick={handleAnalyse} disabled={!file || loading} className="w-full">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analysing…</> : "Analyse Architecture"}
        </Button>
      </div>

      {/* Results */}
      {activeResult && (
        <div className="rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Results</h2>
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => { setResult(null); setSelectedReport(null) }}
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>
          <ReportView data={activeResult.data} name={activeResult.name} />
        </div>
      )}

      {/* Past Reports */}
      {reports.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">Past Reports</h2>
          <div className="rounded-lg border divide-y">
            {reports.map(r => (
              <button
                key={r.name}
                className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4"
                onClick={() => loadReport(r.name)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.architectureType.replace(/_/g, " ")} · {r.nodeCount} nodes · {r.attackPathCount} attack path{r.attackPathCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskBg(r.riskScore)}`}>
                    Risk {r.riskScore}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${defBg(r.defensibility)}`}>
                    Def {r.defensibility}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
