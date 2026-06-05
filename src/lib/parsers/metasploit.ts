import type { ParseResult, ParsedFinding, Severity } from "@/types"

// Metasploit db_export -f xml produces <MetasploitV4> or <MetasploitV5> root elements.
// Structure: hosts → host → { address, name, os_name, services, vulns }
// Refs inside <vuln> are plain text lines: "CVE-2017-0144", "MSB-MS17-010", "URL-https://..."

function severityFromRefs(refs: string[]): Severity {
  // CVSSv3 score is not in the export; use presence of CVE/MSB as a proxy for confirmed high
  const hasCve = refs.some((r) => /^CVE-/i.test(r))
  const hasMsb = refs.some((r) => /^MSB-/i.test(r))
  if (hasCve || hasMsb) return "high"
  if (refs.length > 0) return "medium"
  return "medium"
}

function extractText(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return m ? m[1].trim() : undefined
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim())
  return results
}

export function parseMetasploitXml(xmlContent: string): ParseResult {
  const findings: ParsedFinding[] = []
  const parseWarnings: string[] = []

  try {
    // Confirm this is a Metasploit export
    if (!/<MetasploitV[45]/i.test(xmlContent)) {
      parseWarnings.push(
        "File does not appear to be a Metasploit XML export. Run: db_export -f xml /path/to/export.xml"
      )
      return { findings, parseWarnings }
    }

    const hostBlocks = extractAll(xmlContent, "host")

    if (hostBlocks.length === 0) {
      parseWarnings.push("No host entries found in the export.")
      return { findings, parseWarnings }
    }

    for (const hostXml of hostBlocks) {
      try {
        const ip = extractText(hostXml, "address")
        const hostname = extractText(hostXml, "name") || ip
        const osName = extractText(hostXml, "os_name")
        const osFlavor = extractText(hostXml, "os_flavor")
        const osLabel = [osName, osFlavor].filter(Boolean).join(" ") || undefined

        // --- Vulnerabilities ---
        const vulnBlocks = extractAll(hostXml, "vuln")
        for (const vulnXml of vulnBlocks) {
          try {
            const name = extractText(vulnXml, "name") ?? "Unknown vulnerability"
            const info = extractText(vulnXml, "info")

            const refBlocks = extractAll(vulnXml, "ref")
            const cveIds = refBlocks
              .filter((r) => /^CVE-/i.test(r))
              .join(", ") || undefined

            const severity = severityFromRefs(refBlocks)

            const descParts: string[] = []
            if (info) descParts.push(info)
            if (osLabel) descParts.push(`Host OS: ${osLabel}`)
            const urlRefs = refBlocks.filter((r) => /^URL-/i.test(r)).map((r) => r.replace(/^URL-/i, ""))
            if (urlRefs.length > 0) descParts.push(`References:\n${urlRefs.join("\n")}`)

            // Truncate fields to prevent unbounded DB row growth from malicious XML
            findings.push({
              title: name.slice(0, 500),
              description: (descParts.join("\n\n") || name).slice(0, 50000),
              severity,
              host: (hostname ?? ip ?? "").slice(0, 500),
              cveIds: cveIds ? cveIds.slice(0, 1000) : undefined,
              source: "metasploit",
            })
          } catch (e) {
            parseWarnings.push(`Skipped malformed vuln entry on ${ip}: ${String(e)}`)
          }
        }

        // --- Open services (info-level, only if no vulns found for the host) ---
        if (vulnBlocks.length === 0) {
          const serviceBlocks = extractAll(hostXml, "service")
          for (const svcXml of serviceBlocks) {
            try {
              const portStr = extractText(svcXml, "port")
              const proto = extractText(svcXml, "proto") ?? "tcp"
              const state = extractText(svcXml, "state")
              if (state && state !== "open") continue

              const port = portStr ? parseInt(portStr, 10) : undefined
              const svcName = extractText(svcXml, "name") ?? "unknown"
              const svcInfo = extractText(svcXml, "info")

              findings.push({
                title: `Open ${proto}/${port} (${svcName}) on ${hostname}`.slice(0, 500),
                description: (svcInfo
                  ? `Service banner: ${svcInfo}${osLabel ? `\nHost OS: ${osLabel}` : ""}`
                  : `Open service discovered${osLabel ? `\nHost OS: ${osLabel}` : ""}`).slice(0, 50000),
                severity: "info",
                host: (hostname ?? ip ?? "").slice(0, 500),
                port: isNaN(port as number) ? undefined : port,
                source: "metasploit",
              })
            } catch (e) {
              parseWarnings.push(`Skipped malformed service on ${ip}: ${String(e)}`)
            }
          }
        }
      } catch (e) {
        parseWarnings.push(`Skipped malformed host entry: ${String(e)}`)
      }
    }

    if (findings.length === 0) {
      parseWarnings.push(
        "No vulnerabilities or open services found. Ensure you exported with: db_export -f xml /path/to/file.xml"
      )
    }
  } catch (e) {
    parseWarnings.push(`Failed to parse Metasploit XML: ${String(e)}`)
  }

  return { findings, parseWarnings }
}
