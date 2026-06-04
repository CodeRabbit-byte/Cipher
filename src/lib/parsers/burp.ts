import type { ParseResult, ParsedFinding, Severity } from "@/types"

function mapSeverity(sev: string): Severity {
  switch (sev?.toLowerCase()) {
    case "high":
      return "high"
    case "medium":
      return "medium"
    case "low":
      return "low"
    case "information":
    case "info":
      return "info"
    default:
      return "info"
  }
}

export function parseBurpXml(xmlContent: string): ParseResult {
  const findings: ParsedFinding[] = []
  const parseWarnings: string[] = []

  try {
    const issueMatches = Array.from(xmlContent.matchAll(/<issue>([\s\S]*?)<\/issue>/g))

    for (const match of issueMatches) {
      try {
        const issueXml = match[1]

        const name = issueXml.match(/<name><!\[CDATA\[([\s\S]*?)\]\]><\/name>/)?.[1]
          ?? issueXml.match(/<name>([\s\S]*?)<\/name>/)?.[1]
          ?? "Unnamed Issue"

        const severity = issueXml.match(/<severity>([\s\S]*?)<\/severity>/)?.[1] ?? "info"
        const host = issueXml.match(/<host ip="[^"]*">([\s\S]*?)<\/host>/)?.[1]
          ?? issueXml.match(/<host>([\s\S]*?)<\/host>/)?.[1]
        const path = issueXml.match(/<path><!\[CDATA\[([\s\S]*?)\]\]><\/path>/)?.[1]
          ?? issueXml.match(/<path>([\s\S]*?)<\/path>/)?.[1]
          ?? ""

        const detail = issueXml.match(/<issueDetail><!\[CDATA\[([\s\S]*?)\]\]><\/issueDetail>/)?.[1]
          ?? issueXml.match(/<issueBackground><!\[CDATA\[([\s\S]*?)\]\]><\/issueBackground>/)?.[1]
          ?? issueXml.match(/<issueDetail>([\s\S]*?)<\/issueDetail>/)?.[1]
          ?? "No detail provided"

        const resolvedSeverity = mapSeverity(severity)

        findings.push({
          title: name.trim(),
          description: detail.replace(/<[^>]+>/g, "").trim(),
          severity: resolvedSeverity,
          host: host ? `${host}${path}` : undefined,
          source: "burp",
        })
      } catch (e) {
        parseWarnings.push(`Skipped malformed issue: ${String(e)}`)
      }
    }

    if (findings.length === 0) {
      parseWarnings.push(
        "No issues found. Ensure the file is a Burp Suite XML export (Target → Site map → Save selected items)."
      )
    }
  } catch (e) {
    parseWarnings.push(`Failed to parse Burp XML: ${String(e)}`)
  }

  return { findings, parseWarnings }
}
