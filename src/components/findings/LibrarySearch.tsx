"use client"

import { useState, useMemo, useDeferredValue, memo, useRef } from "react"
import { Input } from "@/components/ui/input"
import { SeverityBadge } from "./SeverityBadge"
import { Button } from "@/components/ui/button"
import {
  Search, BookMarked, Database, Loader2, ExternalLink,
  ChevronDown, ChevronUp, AlertTriangle, ShieldAlert,
} from "lucide-react"
import type { CveItem } from "@/lib/cve"

// Module-level cache — persists across renders and tab switches for the session
const cveQueryCache = new Map<string, CveItem[]>()

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

// ── severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_COLOURS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300",
  HIGH:     "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300",
  MEDIUM:   "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300",
  LOW:      "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300",
}

function cvssColour(sev: string | null) {
  return SEVERITY_COLOURS[sev ?? ""] ?? "bg-muted text-muted-foreground border-border"
}

// ── CVE card ─────────────────────────────────────────────────────────────────

const CveCard = memo(function CveCard({ cve }: { cve: CveItem }) {
  const [expanded, setExpanded] = useState(false)
  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cve.id}`

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-foreground">{cve.id}</span>
            {cve.cvssScore !== null && (
              <span
                className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold ${cvssColour(cve.cvssSeverity)}`}
              >
                CVSS {cve.cvssVersion} {cve.cvssScore.toFixed(1)} — {cve.cvssSeverity}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                cve.vulnStatus === "Analyzed"
                  ? "bg-green-50 text-green-700 border-green-300"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              {cve.vulnStatus}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            <span>Published: {cve.published}</span>
            <span>Modified: {cve.lastModified}</span>
            {cve.cweIds.length > 0 && (
              <span className="font-mono">{cve.cweIds.slice(0, 2).join(" · ")}</span>
            )}
          </div>

          {cve.cvssVector && (
            <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 truncate">
              {cve.cvssVector}
            </p>
          )}

          <p className={`text-sm text-foreground mt-1.5 leading-snug ${expanded ? "" : "line-clamp-2"}`}>
            {cve.description}
          </p>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border rounded px-2 py-1"
          >
            {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {expanded ? "Less" : "More"}
          </button>
          <a
            href={nvdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border rounded px-2 py-1"
          >
            NVD <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {/* Expanded references */}
      {expanded && cve.references.length > 0 && (
        <div className="border-t px-4 py-2.5 bg-muted/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            References
          </p>
          <ul className="space-y-0.5">
            {cve.references.slice(0, 5).map((ref) => (
              <li key={ref}>
                <a
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:underline truncate block"
                >
                  {ref}
                </a>
              </li>
            ))}
            {cve.references.length > 5 && (
              <li className="text-[10px] text-muted-foreground">
                +{cve.references.length - 5} more — see NVD
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
})

// ── CVE Database tab ──────────────────────────────────────────────────────────

function CveDatabaseTab() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function search() {
    const q = query.trim()
    if (!q || loading) return
    setSearched(true)
    // Return cached result instantly
    if (cveQueryCache.has(q)) {
      const cached = cveQueryCache.get(q)!
      setResults(cached)
      setError(cached.length === 0 ? "No CVEs found — try a different keyword or CVE ID" : null)
      return
    }
    setLoading(true)
    setError(null)
    setResults([])
    try {
      const res = await fetch(`/api/cve?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Search failed"); return }
      const cves: CveItem[] = json.cves ?? []
      cveQueryCache.set(q, cves)
      setResults(cves)
      if (cves.length === 0) setError("No CVEs found — try a different keyword or CVE ID")
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="CVE-2021-44228  ·  log4j  ·  apache rce  ·  sql injection…"
            className="pl-9"
          />
        </div>
        <Button onClick={search} disabled={loading || query.trim().length < 3}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {/* Empty state */}
      {!searched && (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Search 355 000+ CVEs from 1999 to present</p>
          <p className="text-xs mt-1 max-w-xs mx-auto">
            Enter a CVE ID for exact lookup, or keywords like a product name, vendor, or
            vulnerability class. Powered by the NVD 2.0 API.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["CVE-2021-44228", "log4shell", "spring4shell", "PrintNightmare", "ProxyLogon"].map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); }}
                className="text-[11px] font-mono px-2.5 py-1 rounded-full border hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive py-4 text-center">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            {results.length} result{results.length !== 1 ? "s" : ""}
            {results.length === 15 ? " (showing top 15)" : ""}
          </p>
          <div className="space-y-2">
            {results.map((cve) => (
              <CveCard key={cve.id} cve={cve} />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-3 text-center">
            Data from NIST NVD · 355 000+ CVEs 1999–present ·{" "}
            <a
              href="https://nvd.nist.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              nvd.nist.gov
            </a>
          </p>
        </>
      )}
    </div>
  )
}

// ── Inline CVE detail panel ───────────────────────────────────────────────────

function CveDetailPanel({ cve }: { cve: CveItem }) {
  return (
    <div className="px-4 py-3 space-y-2.5 text-sm">
      {/* Score + status row */}
      <div className="flex items-center gap-2 flex-wrap">
        {cve.cvssScore !== null && (
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold ${cvssColour(cve.cvssSeverity)}`}>
            CVSS {cve.cvssVersion} {cve.cvssScore.toFixed(1)} — {cve.cvssSeverity}
          </span>
        )}
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
          cve.vulnStatus === "Analyzed"
            ? "bg-green-50 text-green-700 border-green-300"
            : "bg-muted text-muted-foreground border-border"
        }`}>
          {cve.vulnStatus}
        </span>
        <span className="text-xs text-muted-foreground">Published: {cve.published}</span>
        <span className="text-xs text-muted-foreground">Modified: {cve.lastModified}</span>
      </div>

      {/* CVSS vector */}
      {cve.cvssVector && (
        <p className="text-[10px] font-mono text-muted-foreground bg-muted/40 rounded px-2 py-1">
          {cve.cvssVector}
        </p>
      )}

      {/* CWE */}
      {cve.cweIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cve.cweIds.map((id) => (
            <span key={id} className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">
              {id}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      <p className="text-sm leading-relaxed text-foreground">{cve.description}</p>

      {/* References */}
      {cve.references.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            References
          </p>
          <ul className="space-y-0.5">
            {cve.references.slice(0, 5).map((ref) => (
              <li key={ref}>
                <a
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:underline truncate block"
                >
                  {ref}
                </a>
              </li>
            ))}
            {cve.references.length > 5 && (
              <li className="text-[10px] text-muted-foreground">
                +{cve.references.length - 5} more —{" "}
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  view all on NVD
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Finding row (with inline CVE expansion) ───────────────────────────────────

const LibraryFindingRow = memo(function LibraryFindingRow({ finding }: { finding: LibraryFinding }) {
  const [copied, setCopied] = useState(false)
  const [openCveId, setOpenCveId] = useState<string | null>(null)
  const [localCveData, setLocalCveData] = useState<Record<string, CveItem>>({})
  const [cveLoading, setCveLoading] = useState<string | null>(null)

  const cveList = finding.cveIds
    ? finding.cveIds.split(",").map((s) => s.trim()).filter(Boolean)
    : []

  async function toggleCve(id: string) {
    if (openCveId === id) { setOpenCveId(null); return }
    setOpenCveId(id)
    // Already in local state
    if (localCveData[id]) return
    // Check module-level cache first (shared with CVE tab)
    const cached = cveQueryCache.get(id)
    if (cached?.[0]) {
      setLocalCveData((prev) => ({ ...prev, [id]: cached[0] }))
      return
    }
    setCveLoading(id)
    try {
      const res = await fetch(`/api/cve?q=${encodeURIComponent(id)}`)
      const json = await res.json()
      if (res.ok && json.cves?.[0]) {
        cveQueryCache.set(id, json.cves)        // populate shared cache
        setLocalCveData((prev) => ({ ...prev, [id]: json.cves[0] }))
      }
    } catch { /* silently fail */ }
    finally { setCveLoading(null) }
  }

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
    <div className="border rounded-lg overflow-hidden">
      {/* Main row */}
      <div className="p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={finding.severity} />
            <span className="font-medium text-sm">{finding.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>{finding.engagementName}</span>
            <span>·</span>
            <span>{finding.clientName}</span>
            <span>·</span>
            <span>{new Date(finding.createdAt).toLocaleDateString()}</span>
          </div>
          {cveList.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {cveList.map((id) => (
                <button
                  key={id}
                  onClick={() => toggleCve(id)}
                  className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    openCveId === id
                      ? "bg-orange-100 text-orange-800 border-orange-400 dark:bg-orange-900/40 dark:text-orange-200"
                      : "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-300 hover:bg-orange-100"
                  }`}
                >
                  {id}
                  {cveLoading === id
                    ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    : openCveId === id
                      ? <ChevronUp className="h-2.5 w-2.5" />
                      : <ChevronDown className="h-2.5 w-2.5" />
                  }
                </button>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={useAsTemplate}>
          <BookMarked className="h-3 w-3" />
          {copied ? "Copied!" : "Use as template"}
        </Button>
      </div>

      {/* Inline CVE detail */}
      {openCveId && (
        <div className="border-t bg-muted/10">
          {cveLoading === openCveId ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading {openCveId}…
            </div>
          ) : localCveData[openCveId] ? (
            <CveDetailPanel cve={localCveData[openCveId]} />
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Could not load CVE data — check your connection or{" "}
              <a
                href={`https://nvd.nist.gov/vuln/detail/${openCveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                view on NVD
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
})

// ── Main component ────────────────────────────────────────────────────────────

export function LibrarySearch({ findings }: Props) {
  const [tab, setTab] = useState<"findings" | "cve">("findings")
  const [query, setQuery] = useState("")
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  // Defers the expensive filter + re-render of all rows until the browser is idle,
  // so the input itself always feels instant regardless of list size.
  const deferredQuery = useDeferredValue(query)
  const deferredSeverity = useDeferredValue(severityFilter)

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase()
    return findings.filter((f) => {
      const matchQuery =
        !q ||
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.cveIds ?? "").toLowerCase().includes(q) ||
        (f.host ?? "").toLowerCase().includes(q) ||
        f.engagementName.toLowerCase().includes(q)
      const matchSeverity = !deferredSeverity || f.severity === deferredSeverity
      return matchQuery && matchSeverity
    })
  }, [findings, deferredQuery, deferredSeverity])

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b mb-5">
        <button
          onClick={() => setTab("findings")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "findings"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Findings ({findings.length})
        </button>
        <button
          onClick={() => setTab("cve")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            tab === "cve"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          CVE Database
        </button>
      </div>

      {/* Findings tab */}
      {tab === "findings" && (
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
      )}

      {/* CVE Database tab */}
      {tab === "cve" && <CveDatabaseTab />}
    </div>
  )
}
