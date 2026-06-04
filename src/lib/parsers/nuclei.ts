import type { ParseResult, ParsedFinding, Severity } from "@/types"

function mapNucleiSeverity(sev: string): Severity {
  switch (sev?.toLowerCase()) {
    case "critical":
      return "critical"
    case "high":
      return "high"
    case "medium":
      return "medium"
    case "low":
      return "low"
    case "info":
    case "unknown":
    default:
      return "info"
  }
}

interface NucleiResult {
  "template-id"?: string
  info?: {
    name?: string
    severity?: string
    description?: string
    classification?: {
      "cve-id"?: string | string[]
      "cwe-id"?: string | string[]
    }
  }
  host?: string
  ip?: string
  port?: string
  matched?: string
  "matched-at"?: string
  extracted?: string[]
}

export function parseNucleiJson(jsonContent: string): ParseResult {
  const findings: ParsedFinding[] = []
  const parseWarnings: string[] = []

  const lines = jsonContent.trim().split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    try {
      const result: NucleiResult = JSON.parse(line)

      const name = result.info?.name ?? result["template-id"] ?? "Unknown finding"
      const severity = mapNucleiSeverity(result.info?.severity ?? "")
      const description = result.info?.description ?? `Template: ${result["template-id"] ?? "unknown"}`

      const host = result.host ?? result.ip
      const portStr = result.port
      const port = portStr ? parseInt(portStr, 10) : undefined

      const cveRaw = result.info?.classification?.["cve-id"]
      const cveIds = Array.isArray(cveRaw)
        ? cveRaw.join(", ")
        : cveRaw ?? undefined

      const matchedAt = result["matched-at"] ?? result.matched

      findings.push({
        title: name,
        description: description + (matchedAt ? `\nMatched at: ${matchedAt}` : ""),
        severity,
        host: host ? String(host) : undefined,
        port: isNaN(port as number) ? undefined : port,
        cveIds,
        source: "nuclei",
      })
    } catch {
      if (line.length > 0) {
        parseWarnings.push(`Skipped line ${i + 1}: not valid JSON`)
      }
    }
  }

  if (findings.length === 0) {
    parseWarnings.push(
      "No findings parsed. Ensure the file is a Nuclei JSON output (-json -o output.json)."
    )
  }

  return { findings, parseWarnings }
}
