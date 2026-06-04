import type { ParseResult, ParsedFinding, Severity } from "@/types"

function mapNessusRiskFactor(risk: string): Severity {
  switch (risk?.toLowerCase()) {
    case "critical":
      return "critical"
    case "high":
      return "high"
    case "medium":
      return "medium"
    case "low":
      return "low"
    case "none":
    default:
      return "info"
  }
}

export function parseNessusFile(xmlContent: string): ParseResult {
  const findings: ParsedFinding[] = []
  const parseWarnings: string[] = []

  try {
    const hostMatches = Array.from(xmlContent.matchAll(
      /<ReportHost name="([^"]+)">([\s\S]*?)<\/ReportHost>/g
    ))

    for (const hostMatch of hostMatches) {
      const hostName = hostMatch[1]
      const hostXml = hostMatch[2]

      const itemMatches = Array.from(hostXml.matchAll(
        /<ReportItem[^>]+port="(\d+)"[^>]+pluginName="([^"]+)"[^>]*>([\s\S]*?)<\/ReportItem>/g
      ))

      for (const itemMatch of itemMatches) {
        try {
          const port = parseInt(itemMatch[1], 10)
          const pluginName = itemMatch[2]
          const itemXml = itemMatch[3]

          const riskFactor =
            itemXml.match(/<risk_factor>([\s\S]*?)<\/risk_factor>/)?.[1] ?? "None"

          if (riskFactor.toLowerCase() === "none") continue

          const description =
            itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1]
            ?? itemXml.match(/<synopsis>([\s\S]*?)<\/synopsis>/)?.[1]
            ?? "No description provided"

          const solution =
            itemXml.match(/<solution>([\s\S]*?)<\/solution>/)?.[1]

          const cveIds = [...itemXml.matchAll(/<cve>([\s\S]*?)<\/cve>/g)]
            .map((m) => m[1])
            .join(", ")

          const cvssBase =
            itemXml.match(/<cvss3_base_score>([\s\S]*?)<\/cvss3_base_score>/)?.[1]
            ?? itemXml.match(/<cvss_base_score>([\s\S]*?)<\/cvss_base_score>/)?.[1]

          const cvssValue = cvssBase ? parseFloat(cvssBase) : undefined
          findings.push({
            title: pluginName,
            description: description.replace(/<[^>]+>/g, "").trim(),
            severity: mapNessusRiskFactor(riskFactor),
            host: hostName,
            port: isNaN(port) ? undefined : port,
            cvss: cvssValue !== undefined && !isNaN(cvssValue) ? cvssValue : undefined,
            cveIds: cveIds || undefined,
            evidence: solution
              ? `Remediation: ${solution.replace(/<[^>]+>/g, "").trim()}`
              : undefined,
            source: "nessus",
          })
        } catch (e) {
          parseWarnings.push(
            `Skipped item on host ${hostName}: ${String(e)}`
          )
        }
      }
    }

    if (findings.length === 0) {
      parseWarnings.push(
        "No findings with non-None risk factor found. Ensure the file is a Nessus export (.nessus format)."
      )
    }
  } catch (e) {
    parseWarnings.push(`Failed to parse Nessus file: ${String(e)}`)
  }

  return { findings, parseWarnings }
}
