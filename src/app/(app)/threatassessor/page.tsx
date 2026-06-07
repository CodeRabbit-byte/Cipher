"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import {
  Upload, Loader2, AlertCircle, ChevronDown, ChevronRight,
  Shield, ShieldAlert, ShieldX, RotateCcw, FileText, Settings,
  Database, Users, Play, CheckCircle2, XCircle, AlertTriangle,
  Download, Eye, RefreshCw, Cpu, BarChart3, Lock, Network,
  Zap, Search, Info,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = "analyze" | "reports" | "expert-review" | "configuration" | "mitre"

interface AttackPath {
  id: string; entry: string; target: string; path: string[]
  hop_count: number; techniques: string[]; rationale: string
}
interface RapidsEntry { risk: number; defensibility: number; rationale: string }
interface GroundTruth {
  architecture: string; description?: string
  controls_present: string[]; controls_missing: string[]
  expected_attack_paths: AttackPath[]
  expected_risk_score: number; expected_defensibility: number
  rapids_assessment: Record<string, RapidsEntry>
  rationale: string
  confidence?: { final?: number; base?: number }
  metadata: { architecture_type: string; node_count: number; edge_count: number; control_coverage: number }
}
interface ReportSummary {
  name: string; riskScore: number; defensibility: number
  architectureType: string; nodeCount: number; attackPathCount: number; controlCoverage: number
}
interface ReportFile {
  filename: string; label: string; type: "markdown" | "json" | "mermaid"; sizeBytes: number
}
interface MitreResult { id: string; name: string; description?: string; tactics?: string[]; mitigations?: { id: string; name: string }[] }
interface ConfigData { [section: string]: Record<string, unknown> }

// ── Helpers ────────────────────────────────────────────────────────────────

const RAPIDS_LABELS: Record<string, string> = {
  ransomware: "Ransomware", application_vulns: "App Vulnerabilities",
  phishing: "Phishing", insider_threat: "Insider Threat",
  dos: "Denial of Service", supply_chain: "Supply Chain",
}
const SSP_PROFILES = [
  { value: "low_risk_cloud",               label: "Low Risk Cloud" },
  { value: "medium_risk_cloud",            label: "Medium Risk Cloud" },
  { value: "high_risk_cloud_cii",          label: "High Risk Cloud (CII)" },
  { value: "low_risk_onprem",              label: "Low Risk On-Premises" },
  { value: "generative_ai",               label: "Generative AI" },
  { value: "digital_services_others",      label: "Digital Services" },
  { value: "digital_services_high_impact", label: "Digital Services (High Impact)" },
  { value: "sandbox",                      label: "Sandbox / Non-Production" },
]

function riskBg(s: number) { return s >= 70 ? "bg-red-100 text-red-700" : s >= 40 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700" }
function defBg(s: number)  { return s >= 60 ? "bg-green-100 text-green-700" : s >= 30 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700" }
function riskColour(s: number) { return s >= 70 ? "text-red-600" : s >= 40 ? "text-amber-600" : "text-green-600" }

function ScoreBar({ value, colour }: { value: number; colour: string }) {
  return <div className="w-full bg-muted rounded-full h-1.5 mt-1"><div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${value}%` }} /></div>
}

function fmt(n: number) { return (n / 1024).toFixed(1) + " KB" }

// ── GroundTruth result view (shared by Analyze + Reports tabs) ─────────────

function GroundTruthView({ data, name }: { data: GroundTruth; name: string }) {
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.metadata.architecture_type.replace(/_/g, " ")} · {data.metadata.node_count} nodes · {data.metadata.edge_count} edges
            {data.confidence?.final !== undefined && (
              <span className="ml-2">· Confidence {Math.round((data.confidence.final ?? 0) * 100)}%</span>
            )}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskBg(data.expected_risk_score)}`}>
          {data.expected_risk_score >= 70 ? "High" : data.expected_risk_score >= 40 ? "Medium" : "Low"} {data.expected_risk_score}/100
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Risk Score", value: `${data.expected_risk_score}/100`, sub: "Higher = worse", icon: <ShieldX className="h-4 w-4 text-red-500" /> },
          { label: "Defensibility", value: `${data.expected_defensibility}/100`, sub: "Higher = better", icon: <Shield className="h-4 w-4 text-green-500" /> },
          { label: "Attack Paths", value: `${data.expected_attack_paths.length}`, sub: "Identified", icon: <ShieldAlert className="h-4 w-4 text-amber-500" /> },
          { label: "Control Coverage", value: `${Math.round(data.metadata.control_coverage * 100)}%`, sub: "Controls present", icon: <Shield className="h-4 w-4 text-blue-500" /> },
        ].map(c => (
          <div key={c.label} className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.icon}{c.label}</div>
            <p className={`text-xl font-bold ${c.label === "Risk Score" ? riskColour(data.expected_risk_score) : ""}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground border-l-2 pl-3">{data.rationale}</p>

      <div>
        <h3 className="text-sm font-semibold mb-2">RAPIDS Assessment</h3>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Category</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Risk</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Defensibility</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium hidden sm:table-cell">Rationale</th>
            </tr></thead>
            <tbody className="divide-y">
              {Object.entries(data.rapids_assessment).map(([k, v]) => (
                <tr key={k} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{RAPIDS_LABELS[k] ?? k.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${riskBg(v.risk)}`}>{v.risk}</span>
                    <ScoreBar value={v.risk} colour="bg-red-400" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${defBg(v.defensibility)}`}>{v.defensibility}</span>
                    <ScoreBar value={v.defensibility} colour="bg-green-400" />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{v.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.expected_attack_paths.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Attack Paths <span className="text-muted-foreground font-normal">({data.expected_attack_paths.length})</span></h3>
          <div className="space-y-2">
            {data.expected_attack_paths.map(ap => (
              <div key={ap.id} className="rounded-lg border">
                <button className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedPath(expandedPath === ap.id ? null : ap.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{ap.id}</span>
                    <span className="text-sm font-medium truncate">{ap.entry} → {ap.target}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{ap.hop_count} hops</span>
                  </div>
                  {expandedPath === ap.id ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
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
                        <span key={t} className="text-xs font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">{t}</span>
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

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-green-700">Controls Present <span className="font-normal text-muted-foreground">({data.controls_present.length})</span></h3>
          {data.controls_present.length === 0 ? <p className="text-xs text-muted-foreground">None detected</p> : (
            <ul className="space-y-1">{data.controls_present.map(c => <li key={c} className="text-xs flex gap-1.5"><span className="text-green-500 shrink-0">✓</span>{c}</li>)}</ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 text-red-700">Controls Missing <span className="font-normal text-muted-foreground">({data.controls_missing.length})</span></h3>
          {data.controls_missing.length === 0 ? <p className="text-xs text-muted-foreground">No gaps detected</p> : (
            <ul className="space-y-1">{data.controls_missing.map(c => <li key={c} className="text-xs flex gap-1.5"><span className="text-red-500 shrink-0">✗</span>{c}</li>)}</ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── TAB: ANALYZE ───────────────────────────────────────────────────────────

function AnalyzeTab() {
  const [file, setFile]     = useState<File | null>(null)
  const [dragging, setDrag] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [sspProfile, setSsp] = useState("medium_risk_cloud")
  const [result, setResult] = useState<{ data: GroundTruth; name: string; files: string[] } | null>(null)
  const [stage, setStage]   = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const STAGES = ["Parsing Mermaid diagram", "Loading MITRE ATT&CK", "Running RAPIDS assessment", "Mapping attack paths", "Analysing controls", "Generating reports"]

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith(".mmd")) { setFile(f); setError(null) }
    else setError("Only .mmd Mermaid diagram files are accepted.")
  }, [])

  async function handleAnalyse() {
    if (!file) return
    setLoading(true); setError(null); setResult(null); setStage(STAGES[0])
    const stageTimer = setInterval(() => {
      setStage(prev => { const i = STAGES.indexOf(prev); return i < STAGES.length - 1 ? STAGES[i + 1] : prev })
    }, 5000)

    const form = new FormData()
    form.append("architecture_file", file, file.name)
    form.append("ssp_profile", sspProfile)
    form.append("generate_reports", "true")

    try {
      const res  = await fetch("/api/threatassessor/analyze", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Analysis failed."); return }
      setResult({ data: data.data, name: data.architectureName, files: data.generatedFiles ?? [] })
    } catch {
      setError("Network error — could not reach the CIPHER server.")
    } finally {
      clearInterval(stageTimer); setLoading(false); setStage("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-5 space-y-4">
        <h2 className="text-sm font-semibold">New Analysis</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">SSP Profile</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={sspProfile}
              onChange={e => setSsp(e.target.value)}
            >
              {SSP_PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Architecture File</label>
            <button
              type="button"
              className={`flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors text-sm ${
                dragging ? "border-primary bg-primary/5" : file ? "border-green-400 bg-green-50" : "border-muted-foreground/30 hover:border-primary/60"
              }`}
              onDragEnter={() => setDrag(true)}
              onDragLeave={() => setDrag(false)}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".mmd" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f?.name.endsWith(".mmd")) { setFile(f); setError(null) } else setError("Only .mmd files accepted.") }} />
              <Upload className="h-5 w-5 text-muted-foreground mb-1" />
              {file ? <span className="font-medium text-green-700 truncate max-w-full">{file.name}</span>
                : <span className="text-muted-foreground">Drop .mmd file or click</span>}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {loading && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{stage || "Analysing…"}</span>
            </div>
            <div className="flex gap-1">
              {STAGES.map((s, i) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
                  s === stage ? "bg-primary" : STAGES.indexOf(stage) > i ? "bg-primary/40" : "bg-muted"
                }`} />
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleAnalyse} disabled={!file || loading} className="w-full">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analysing…</> : <><Play className="h-4 w-4 mr-2" />Run Analysis</>}
        </Button>
      </div>

      {result && (
        <div className="rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Results</h2>
            <div className="flex items-center gap-3">
              {result.files.length > 1 && (
                <p className="text-xs text-muted-foreground">{result.files.length} report files generated — view in Reports tab</p>
              )}
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setResult(null)}>
                <RotateCcw className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>
          <GroundTruthView data={result.data} name={result.name} />
        </div>
      )}
    </div>
  )
}

// ── TAB: REPORTS ──────────────────────────────────────────────────────────

function MermaidDiagram({ mmd }: { mmd: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState("")
  const [err, setErr] = useState(false)

  useEffect(() => {
    import("mermaid").then(m => {
      const id = "mmd-" + Math.random().toString(36).slice(2)
      m.default.initialize({ startOnLoad: false, theme: "default" })
      m.default.render(id, mmd).then((res: { svg: string }) => setRendered(res.svg)).catch(() => setErr(true))
    }).catch(() => setErr(true))
  }, [mmd])

  if (err) return <pre className="text-xs font-mono p-4 bg-muted rounded overflow-auto whitespace-pre-wrap">{mmd}</pre>
  if (!rendered) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Rendering diagram…</div>
  return <div ref={ref} className="overflow-auto p-2" dangerouslySetInnerHTML={{ __html: rendered }} />
}

function ReportFileViewer({ archName, file }: { archName: string; file: ReportFile }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setContent(null); setError(null); setLoading(true)
    fetch(`/api/threatassessor/reports/${archName}/files?f=${file.filename}`)
      .then(r => r.json())
      .then(d => setContent(d.content ?? ""))
      .catch(() => setError("Failed to load file."))
      .finally(() => setLoading(false))
  }, [archName, file.filename])

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
  if (error) return <div className="text-red-500 text-sm py-4">{error}</div>
  if (content === null) return null

  if (file.type === "mermaid") return <MermaidDiagram mmd={content} />

  if (file.type === "json") {
    try {
      return <pre className="text-xs font-mono p-4 bg-muted rounded-lg overflow-auto whitespace-pre-wrap max-h-[70vh]">{JSON.stringify(JSON.parse(content), null, 2)}</pre>
    } catch {
      return <pre className="text-xs font-mono p-4 bg-muted rounded-lg overflow-auto whitespace-pre-wrap max-h-[70vh]">{content}</pre>
    }
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-1
      [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-auto
      [&_table]:text-xs [&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_table]:border [&_td]:border-muted [&_th]:border-muted">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

function ReportsTab() {
  const [reports, setReports]       = useState<ReportSummary[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [files, setFiles]           = useState<ReportFile[]>([])
  const [activeFile, setActiveFile] = useState<ReportFile | null>(null)
  const [loading, setLoading]       = useState(false)
  const [gtData, setGtData]         = useState<GroundTruth | null>(null)

  useEffect(() => {
    fetch("/api/threatassessor/reports").then(r => r.json()).then(d => setReports(d.reports ?? [])).catch(() => {})
  }, [])

  async function selectArch(name: string) {
    setSelected(name); setFiles([]); setActiveFile(null); setGtData(null); setLoading(true)
    try {
      const [filesRes, gtRes] = await Promise.all([
        fetch(`/api/threatassessor/reports/${name}/files`).then(r => r.json()),
        fetch(`/api/threatassessor/reports/${name}`).then(r => r.json()),
      ])
      setFiles(filesRes.files ?? [])
      setGtData(gtRes.data ?? null)
      // Default to first file
      if (filesRes.files?.length) setActiveFile(filesRes.files[0])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  return (
    <div className="flex gap-4 min-h-[500px]">
      {/* Architecture list */}
      <div className="w-56 shrink-0">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Architectures</h3>
        {reports.length === 0
          ? <p className="text-xs text-muted-foreground">No reports yet. Run an analysis first.</p>
          : (
            <div className="space-y-1">
              {reports.map(r => (
                <button
                  key={r.name}
                  onClick={() => selectArch(r.name)}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${selected === r.name ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}
                >
                  <p className="truncate">{r.name}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 rounded ${riskBg(r.riskScore)}`}>R{r.riskScore}</span>
                    <span className={`text-[10px] font-semibold px-1.5 rounded ${defBg(r.defensibility)}`}>D{r.defensibility}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Select an architecture to view its reports</p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm justify-center py-20">
            <Loader2 className="h-4 w-4 animate-spin" />Loading reports…
          </div>
        ) : (
          <div className="space-y-4">
            {/* File tabs */}
            <div className="flex flex-wrap gap-1.5 border-b pb-3">
              {files.map(f => (
                <button
                  key={f.filename}
                  onClick={() => setActiveFile(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeFile?.filename === f.filename ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {files.length === 0 && gtData && (
                <button onClick={() => setActiveFile({ filename: "_gt", label: "Ground Truth", type: "json", sizeBytes: 0 })}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground">
                  Ground Truth
                </button>
              )}
            </div>

            {/* Active file content */}
            {activeFile && (
              activeFile.filename === "_gt" && gtData
                ? <GroundTruthView data={gtData} name={selected} />
                : <ReportFileViewer archName={selected} file={activeFile} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TAB: EXPERT REVIEW (MoE) ───────────────────────────────────────────────

function ExpertReviewTab() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [serverDown, setServerDown] = useState(false)
  const [archs, setArchs]     = useState<ReportSummary[]>([])
  const [arch, setArch]       = useState("")
  const [criticMode, setCriticMode] = useState("sequential")
  const [runBlackhat, setRunBlackhat] = useState(true)
  const [running, setRunning] = useState(false)
  const [events, setEvents]   = useState<string[]>([])
  const [result, setResult]   = useState<Record<string, unknown> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/threatassessor/expert-review?architecture_name=__ping__")
      .then(r => r.json())
      .then(d => { setConfigured(!(d.configured === false)); setServerDown(d.serverDown === true) })
      .catch(() => setConfigured(false))
    fetch("/api/threatassessor/reports").then(r => r.json()).then(d => setArchs(d.reports ?? []))
  }, [])

  async function runReview() {
    if (!arch) return
    setRunning(true); setEvents([]); setResult(null)
    const url = `/api/threatassessor/expert-review?architecture_name=${encodeURIComponent(arch)}&critic_mode=${criticMode}&run_blackhat=${runBlackhat}`
    try {
      const res = await fetch(url)
      const contentType = res.headers.get("content-type") ?? ""
      if (contentType.includes("application/json")) {
        const d = await res.json()
        setEvents([`Error: ${d.error ?? "Unknown error"}`])
        setRunning(false); return
      }
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) { setRunning(false); return }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        for (const line of text.split("\n")) {
          if (!line.trim()) continue
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim()
            try {
              const parsed = JSON.parse(payload)
              if (parsed.type === "complete" || parsed.type === "final") {
                setResult(parsed.data ?? parsed)
              }
              const msg = parsed.message ?? parsed.event ?? payload
              setEvents(prev => [...prev, String(msg)])
            } catch {
              setEvents(prev => [...prev, payload])
            }
          }
        }
      }
    } catch (e) {
      setEvents(prev => [...prev, `Connection error: ${(e as Error).message}`])
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [events])

  const CRITICS = [
    { key: "architect",    icon: <Cpu className="h-4 w-4" />,      label: "Architect",     desc: "Design quality & defense-in-depth validation" },
    { key: "tester",       icon: <CheckCircle2 className="h-4 w-4" />, label: "Tester",    desc: "MITRE technique mapping & internal consistency" },
    { key: "red_team",     icon: <ShieldX className="h-4 w-4" />,   label: "Red Teamer",    desc: "Control effectiveness & exploit difficulty (inverted)" },
    { key: "purple_team",  icon: <BarChart3 className="h-4 w-4" />, label: "Purple Teamer", desc: "Detection chain operability & ADR readiness" },
    { key: "blackhat",     icon: <AlertTriangle className="h-4 w-4" />, label: "Blackhat",  desc: "Cross-path chaining, pivot nodes, stealth scoring" },
  ]

  if (configured === null) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-20 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Checking ThreatAssessor API…</div>
  }

  return (
    <div className="space-y-6">
      {/* Architecture overview */}
      <div className="rounded-lg border p-4 bg-muted/20">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><Users className="h-4 w-4" />Mixture-of-Experts Pipeline</h3>
        <p className="text-xs text-muted-foreground mb-3">Five specialised critics validate the deterministic assessment from different angles, each adjusting confidence by ±0–10%. The MoE Orchestrator synthesises consensus findings, contradictions, and blindspots.</p>
        <div className="grid sm:grid-cols-5 gap-2">
          {CRITICS.map((c, i) => (
            <div key={c.key} className="rounded-md border p-2 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-xs font-medium">
                <span className="w-4 h-4 rounded-full bg-muted text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                {c.icon}
              </div>
              <p className="text-xs font-semibold">{c.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {!configured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800">ThreatAssessor API not configured</h3>
              <p className="text-xs text-amber-700 mt-1">Expert Review requires the ThreatAssessor FastAPI server and an LLM API key (OpenRouter or AWS Bedrock).</p>
            </div>
          </div>
          <div className="rounded-md bg-white border border-amber-100 p-3">
            <pre className="text-xs font-mono overflow-auto whitespace-pre-wrap">{`# 1. Start ThreatAssessor API server
cd vendor/threatassessor
pip install -r requirements.txt
./scripts/api/api_start.sh   # or: uvicorn chatbot.api.app:app --port 8000

# 2. Add to CIPHER .env
THREATASSESSOR_URL=http://localhost:8000
THREATASSESSOR_API_KEY=any

# 3. Add LLM key to vendor/threatassessor/.env
OPENROUTER_API_KEY=sk-or-...   # free at openrouter.ai/keys`}</pre>
          </div>
        </div>
      ) : serverDown ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">ThreatAssessor API server is not running</h3>
              <p className="text-xs text-red-700 mt-1">THREATASSESSOR_URL is set but the server at <code>{process.env.NEXT_PUBLIC_TA_URL ?? "localhost:8000"}</code> is unreachable.</p>
            </div>
          </div>
          <pre className="text-xs font-mono bg-white border border-red-100 rounded p-3 overflow-auto whitespace-pre-wrap">{`cd vendor/threatassessor
./scripts/api/api_start.sh
# or: python -m uvicorn chatbot.api.app:app --host 0.0.0.0 --port 8000`}</pre>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Architecture</label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={arch} onChange={e => setArch(e.target.value)}>
                <option value="">— select —</option>
                {archs.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Critic Mode</label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={criticMode} onChange={e => setCriticMode(e.target.value)}>
                <option value="sequential">Sequential (thorough)</option>
                <option value="parallel">Parallel (fast)</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Options</label>
              <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer">
                <input type="checkbox" checked={runBlackhat} onChange={e => setRunBlackhat(e.target.checked)} className="rounded" />
                Include Blackhat Critic
              </label>
            </div>
          </div>
          <Button onClick={runReview} disabled={!arch || running} className="w-full">
            {running ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running MoE Review…</> : <><Zap className="h-4 w-4 mr-2" />Run Expert Review</>}
          </Button>

          {events.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Live Progress</p>
              <div ref={scrollRef} className="rounded-lg border bg-muted/30 p-3 max-h-48 overflow-y-auto space-y-1">
                {events.map((e, i) => <p key={i} className="text-xs font-mono">{e}</p>)}
                {running && <p className="text-xs text-muted-foreground animate-pulse">Streaming…</p>}
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="text-sm font-semibold">MoE Result</h3>
              {(result.synthesis as Record<string, unknown>)?.consensus_confidence !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{Math.round(((result.synthesis as Record<string, unknown>).consensus_confidence as number) * 100)}%</span>
                  <span className="text-sm text-muted-foreground">consensus confidence</span>
                </div>
              )}
              <pre className="text-xs font-mono bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── TAB: CONFIGURATION ─────────────────────────────────────────────────────

function ConfigTab() {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [defaults, setDefaults] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    fetch("/api/threatassessor/config").then(r => r.json()).then(d => {
      setConfig(d.config); setDefaults(d.defaults)
    }).finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!config) return
    setSaving(true)
    await fetch("/api/threatassessor/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function reset() {
    setSaving(true)
    const r = await fetch("/api/threatassessor/config", { method: "DELETE" }).then(r => r.json())
    setConfig(r.config); setSaving(false)
  }

  function updateValue(section: string, key: string, value: unknown) {
    setConfig(prev => prev ? { ...prev, [section]: { ...prev[section], [key]: value } } : prev)
  }

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground text-sm py-20 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Loading settings…</div>
  if (!config) return <div className="text-red-500 text-sm py-4">Failed to load configuration.</div>

  const CONFIG_SCHEMA: Record<string, { label: string; icon: React.ReactNode; fields: { key: string; label: string; type: "number" | "boolean" | "select" | "multiselect"; min?: number; max?: number; step?: number; options?: { value: string; label: string }[] }[] }> = {
    engine: {
      label: "Analysis Engine", icon: <Cpu className="h-4 w-4" />,
      fields: [
        { key: "max_paths", label: "Max Paths (1–50)", type: "number", min: 1, max: 50 },
        { key: "top_n", label: "Top-N Paths (1–20)", type: "number", min: 1, max: 20 },
        { key: "weight_target", label: "Target Weight", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "weight_length", label: "Length Weight", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "weight_control", label: "Control Weight", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "weight_entry", label: "Entry Weight", type: "number", min: 0, max: 1, step: 0.05 },
      ],
    },
    confidence: {
      label: "Confidence Scoring", icon: <BarChart3 className="h-4 w-4" />,
      fields: [
        { key: "base_confidence_floor", label: "Floor (0.5–0.99)", type: "number", min: 0.5, max: 0.99, step: 0.01 },
        { key: "base_confidence_ceiling", label: "Ceiling (0.5–1.0)", type: "number", min: 0.5, max: 1.0, step: 0.01 },
        { key: "node_penalty_factor", label: "Node Penalty", type: "number", min: 0, max: 0.05, step: 0.001 },
        { key: "edge_penalty_factor", label: "Edge Penalty", type: "number", min: 0, max: 0.05, step: 0.001 },
      ],
    },
    residual_risk: {
      label: "Residual Risk", icon: <ShieldAlert className="h-4 w-4" />,
      fields: [
        { key: "min_failure_probability", label: "Min Failure Prob (10% floor)", type: "number", min: 0.01, max: 0.5, step: 0.01 },
        { key: "accept_threshold", label: "Accept Threshold (0–100)", type: "number", min: 0, max: 100 },
        { key: "monitor_threshold", label: "Monitor Threshold (0–100)", type: "number", min: 0, max: 100 },
      ],
    },
    moe: {
      label: "MoE Expert Review", icon: <Users className="h-4 w-4" />,
      fields: [
        { key: "enabled", label: "Enable MoE (requires LLM)", type: "boolean" },
        { key: "base_confidence", label: "Base Confidence %", type: "number", min: 50, max: 100 },
        { key: "critic_mode", label: "Critic Mode", type: "select", options: [{ value: "sequential", label: "Sequential" }, { value: "parallel", label: "Parallel" }, { value: "auto", label: "Auto" }] },
        { key: "architect_sensitivity", label: "Architect Sensitivity", type: "select", options: [{ value: "lenient", label: "Lenient" }, { value: "balanced", label: "Balanced" }, { value: "strict", label: "Strict" }] },
        { key: "tester_sensitivity", label: "Tester Sensitivity", type: "select", options: [{ value: "lenient", label: "Lenient" }, { value: "balanced", label: "Balanced" }, { value: "strict", label: "Strict" }] },
        { key: "red_team_sensitivity", label: "Red Team Sensitivity", type: "select", options: [{ value: "lenient", label: "Lenient" }, { value: "balanced", label: "Balanced" }, { value: "strict", label: "Strict" }] },
      ],
    },
    patterns: {
      label: "Pattern Detection", icon: <Network className="h-4 w-4" />,
      fields: [
        { key: "enabled_patterns", label: "Active Patterns", type: "multiselect",
          options: [
            { value: "ai_ml_arc", label: "AI/ML (ARC + ATLAS)" },
            { value: "cloud", label: "Cloud (CAVEAT + CCM)" },
          ]
        },
      ],
    },
    purple_team: {
      label: "Purple Team", icon: <Shield className="h-4 w-4" />,
      fields: [
        { key: "enabled", label: "Enable Purple Team Critic", type: "boolean" },
        { key: "detection_focus", label: "Detection Focus", type: "select", options: [{ value: "balanced", label: "Balanced" }, { value: "detection", label: "Detection-Heavy" }, { value: "coverage", label: "Coverage" }, { value: "adr", label: "ADR Operability" }] },
      ],
    },
    blackhat: {
      label: "Blackhat Critic", icon: <Lock className="h-4 w-4" />,
      fields: [
        { key: "enabled", label: "Enable Blackhat Critic", type: "boolean" },
        { key: "rubric_preset", label: "Rubric Preset", type: "select", options: [{ value: "balanced", label: "Balanced" }, { value: "stealth_focused", label: "Stealth-Focused" }, { value: "chain_focused", label: "Chain-Focused" }, { value: "mitigation_stress", label: "Mitigation Stress" }] },
      ],
    },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Settings are saved to <code className="text-xs bg-muted px-1 py-0.5 rounded">vendor/threatassessor/chatbot/config/user_config.json</code></p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
            <RotateCcw className="h-3 w-3 mr-1.5" />Reset Defaults
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : saved ? <CheckCircle2 className="h-3 w-3 mr-1.5 text-green-500" /> : null}
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </div>
      </div>

      {Object.entries(CONFIG_SCHEMA).map(([section, meta]) => (
        <div key={section} className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">{meta.icon}{meta.label}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {meta.fields.map(field => {
              const val = config[section]?.[field.key]
              const defVal = defaults?.[section]?.[field.key]
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                    <span>{field.label}</span>
                    {val !== defVal && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">modified</span>}
                  </label>
                  {field.type === "boolean" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={Boolean(val)} onChange={e => updateValue(section, field.key, e.target.checked)} className="rounded" />
                      <span className="text-sm">{val ? "Enabled" : "Disabled"}</span>
                    </label>
                  ) : field.type === "select" ? (
                    <select className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={String(val)} onChange={e => updateValue(section, field.key, e.target.value)}>
                      {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : field.type === "multiselect" ? (
                    <div className="space-y-1">
                      {field.options?.map(o => (
                        <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input type="checkbox"
                            checked={Array.isArray(val) && (val as string[]).includes(o.value)}
                            onChange={e => {
                              const arr = Array.isArray(val) ? [...(val as string[])] : []
                              updateValue(section, field.key, e.target.checked ? [...arr, o.value] : arr.filter(v => v !== o.value))
                            }} className="rounded" />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input type="number"
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                      value={Number(val)}
                      min={field.min} max={field.max} step={field.step ?? 1}
                      onChange={e => updateValue(section, field.key, parseFloat(e.target.value))}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── TAB: MITRE LIBRARY ─────────────────────────────────────────────────────

function MitreTab() {
  const [mode, setMode]       = useState<"techniques" | "mitigations" | "technique-mitigations">("techniques")
  const [query, setQuery]     = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<MitreResult[]>([])
  const [error, setError]     = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dataAvailable, setDataAvailable] = useState<boolean | null>(null)
  const [setupHint, setSetupHint] = useState<string | null>(null)

  const EXAMPLES: Record<typeof mode, string[]> = {
    "techniques": ["T1190", "T1059", "phishing", "lateral movement", "sql injection", "credential access"],
    "mitigations": ["M1042", "M1030", "multi-factor", "network segmentation", "patch"],
    "technique-mitigations": ["T1566", "T1078", "T1190", "T1059"],
  }

  useEffect(() => {
    fetch("/api/threatassessor/mitre?mode=status&q=_")
      .then(r => r.json())
      .then(d => { setDataAvailable(d.dataAvailable ?? false); if (d.setupHint) setSetupHint(d.setupHint) })
      .catch(() => setDataAvailable(false))
  }, [])

  async function search(q?: string) {
    const finalQ = q ?? query
    if (!finalQ || finalQ.length < 2) return
    if (q) setQuery(q)
    setLoading(true); setError(null); setResults([])
    try {
      const res  = await fetch(`/api/threatassessor/mitre?mode=${mode}&q=${encodeURIComponent(finalQ)}`)
      const data = await res.json()
      if (data.dataAvailable === false) { setDataAvailable(false); if (data.setupHint) setSetupHint(data.setupHint); return }
      if (data.error && !data.results?.length) { setError(data.error); return }
      setResults(data.results ?? [])
    } catch {
      setError("Network error.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Queries ThreatAssessor's local MITRE ATT&amp;CK data. Supports technique IDs (T1190), mitigation IDs (M1042), and keyword search. Requires <code className="bg-muted px-1 rounded">enterprise-attack.json</code> in <code className="bg-muted px-1 rounded">vendor/threatassessor/chatbot/data/</code>.
          </p>
        </div>
      </div>

      {dataAvailable === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800">MITRE ATT&amp;CK data not available</p>
              <p className="text-xs text-amber-700">The 44 MB <code>enterprise-attack.json</code> corpus is not in git. Run this once to download it:</p>
            </div>
          </div>
          <pre className="text-xs font-mono bg-white border border-amber-100 rounded p-3 overflow-auto whitespace-pre-wrap">{setupHint ?? `cd vendor/threatassessor\n.venv/Scripts/python.exe -c "from chatbot.modules.mitre import MitreHelper; m = MitreHelper(); m.update_data()"`}</pre>
        </div>
      )}

      <div className="flex gap-2">
        <select className="rounded-md border bg-background px-3 py-2 text-sm shrink-0" value={mode} onChange={e => { setMode(e.target.value as typeof mode); setResults([]) }}>
          <option value="techniques">Techniques</option>
          <option value="mitigations">Mitigations</option>
          <option value="technique-mitigations">Technique → Mitigations</option>
        </select>
        <div className="flex-1 flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder={`e.g. ${EXAMPLES[mode][0]}`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
          />
          <Button onClick={() => search()} disabled={loading || query.length < 2}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground">Examples:</span>
        {EXAMPLES[mode].map(ex => (
          <button key={ex} onClick={() => search(ex)}
            className="text-xs bg-muted hover:bg-muted/70 px-2 py-0.5 rounded transition-colors">
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map(r => (
            <div key={r.id} className="rounded-lg border">
              <button
                className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xs font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 shrink-0 mt-0.5">{r.id}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    {r.tactics && r.tactics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.tactics.map(t => <span key={t} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 rounded">{t}</span>)}
                      </div>
                    )}
                  </div>
                </div>
                {expanded === r.id ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />}
              </button>
              {expanded === r.id && (
                <div className="px-4 pb-3 border-t pt-3 space-y-3">
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                  {r.mitigations && r.mitigations.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1.5">Mitigations</p>
                      <div className="space-y-1">
                        {r.mitigations.map(m => (
                          <div key={m.id} className="flex items-center gap-2 text-xs">
                            <span className="font-mono bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">{m.id}</span>
                            <span>{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && !error && (
        <p className="text-sm text-muted-foreground text-center py-8">No results found. Check that MITRE ATT&amp;CK data is available in the venv.</p>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "analyze",       label: "Analyze",        icon: <Play className="h-4 w-4" /> },
  { id: "reports",       label: "Reports",         icon: <FileText className="h-4 w-4" /> },
  { id: "expert-review", label: "Expert Review",   icon: <Users className="h-4 w-4" /> },
  { id: "configuration", label: "Configuration",   icon: <Settings className="h-4 w-4" /> },
  { id: "mitre",         label: "MITRE Library",   icon: <Database className="h-4 w-4" /> },
]

export default function ThreatAssessorPage() {
  const [tab, setTab] = useState<TabId>("analyze")

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Threat Assessor</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deterministic threat modelling from Mermaid architecture diagrams — MITRE ATT&amp;CK, RAPIDS, SSP compliance, MoE expert review, and full report generation.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {tab === "analyze"       && <AnalyzeTab />}
        {tab === "reports"       && <ReportsTab />}
        {tab === "expert-review" && <ExpertReviewTab />}
        {tab === "configuration" && <ConfigTab />}
        {tab === "mitre"         && <MitreTab />}
      </div>
    </div>
  )
}
