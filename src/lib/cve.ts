/**
 * NVD 2.0 API client — https://nvd.nist.gov/developers/vulnerabilities
 * Covers all CVEs from 1999 to present (355 000+).
 * Set NVD_API_KEY in .env for 10× higher rate limit (50 req/30s vs 5 req/30s).
 */

const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"

export interface CveItem {
  id: string
  description: string
  published: string
  lastModified: string
  vulnStatus: string
  cvssScore: number | null
  cvssSeverity: string | null
  cvssVector: string | null
  cvssVersion: string | null
  cweIds: string[]
  references: string[]
}

function normaliseSeverity(score: number | null): string | null {
  if (score === null) return null
  if (score >= 9.0) return "CRITICAL"
  if (score >= 7.0) return "HIGH"
  if (score >= 4.0) return "MEDIUM"
  return "LOW"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCvss(metrics: any): { score: number | null; severity: string | null; vector: string | null; version: string } {
  const v31 = metrics?.cvssMetricV31?.[0]
  if (v31) {
    const score = v31.cvssData?.baseScore ?? null
    return {
      score,
      severity: v31.cvssData?.baseSeverity ?? normaliseSeverity(score),
      vector: v31.cvssData?.vectorString ?? null,
      version: "3.1",
    }
  }
  const v30 = metrics?.cvssMetricV30?.[0]
  if (v30) {
    const score = v30.cvssData?.baseScore ?? null
    return {
      score,
      severity: v30.cvssData?.baseSeverity ?? normaliseSeverity(score),
      vector: v30.cvssData?.vectorString ?? null,
      version: "3.0",
    }
  }
  const v2 = metrics?.cvssMetricV2?.[0]
  if (v2) {
    const score = v2.cvssData?.baseScore ?? null
    return {
      score,
      severity: normaliseSeverity(score),
      vector: v2.cvssData?.vectorString ?? null,
      version: "2.0",
    }
  }
  return { score: null, severity: null, vector: null, version: "unknown" }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVulnerability(v: any): CveItem {
  const cve = v.cve
  const desc =
    cve.descriptions?.find((d: { lang: string; value: string }) => d.lang === "en")?.value ?? ""
  const cvss = extractCvss(cve.metrics)
  const cweIds: string[] =
    cve.weaknesses
      ?.flatMap((w: { description: { value: string }[] }) =>
        w.description.map((d) => d.value)
      )
      .filter((id: string) => id !== "NVD-CWE-noinfo" && id !== "NVD-CWE-Other") ?? []

  return {
    id: cve.id,
    description: desc,
    published: cve.published?.slice(0, 10) ?? "",
    lastModified: cve.lastModified?.slice(0, 10) ?? "",
    vulnStatus: cve.vulnStatus ?? "",
    cvssScore: cvss.score,
    cvssSeverity: cvss.severity,
    cvssVector: cvss.vector,
    cvssVersion: cvss.version,
    cweIds,
    references: cve.references?.map((r: { url: string }) => r.url) ?? [],
  }
}

export async function searchCves(
  query: string,
  { limit = 15 }: { limit?: number } = {}
): Promise<CveItem[]> {
  const params = new URLSearchParams()

  if (/^CVE-\d{4}-\d+$/i.test(query)) {
    params.set("cveId", query.toUpperCase())
  } else {
    params.set("keywordSearch", query)
    params.set("resultsPerPage", String(Math.min(limit, 2000)))
  }

  const headers: Record<string, string> = {
    "User-Agent": "CIPHER-Security-Platform/1.0",
  }
  if (process.env.NVD_API_KEY) {
    headers["apiKey"] = process.env.NVD_API_KEY
  }

  const res = await fetch(`${NVD_BASE}?${params}`, {
    headers,
    // Next.js fetch cache — revalidate hourly
    next: { revalidate: 3600 },
  })

  if (res.status === 404) return []
  if (!res.ok) {
    throw new Error(`NVD API ${res.status}: ${await res.text().catch(() => "")}`)
  }

  const data = await res.json()
  return (data.vulnerabilities ?? []).map(mapVulnerability)
}

export function formatCveForContext(cve: CveItem): string {
  const score = cve.cvssScore !== null ? `CVSS ${cve.cvssVersion} ${cve.cvssScore}` : "No CVSS"
  const severity = cve.cvssSeverity ? ` [${cve.cvssSeverity}]` : ""
  const cwe = cve.cweIds.length ? `\nCWE: ${cve.cweIds.join(", ")}` : ""
  const vector = cve.cvssVector ? `\nVector: ${cve.cvssVector}` : ""
  const refs =
    cve.references.length
      ? `\nReferences:\n${cve.references.slice(0, 3).map((r) => `  - ${r}`).join("\n")}`
      : ""

  return `${cve.id} — ${score}${severity}
Published: ${cve.published} | Status: ${cve.vulnStatus}${cwe}${vector}
Description: ${cve.description}${refs}`
}
