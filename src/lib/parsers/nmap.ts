import type { ParseResult, ParsedFinding, Severity } from "@/types"

function cvssFromScript(scriptOutput: string): Severity {
  const cvssMatch = scriptOutput.match(/CVSS Score:\s*([\d.]+)/i)
  if (!cvssMatch) return "info"
  const score = parseFloat(cvssMatch[1])
  if (score >= 9.0) return "critical"
  if (score >= 7.0) return "high"
  if (score >= 4.0) return "medium"
  if (score >= 0.1) return "low"
  return "info"
}

export function parseNmapXml(xmlContent: string): ParseResult {
  const findings: ParsedFinding[] = []
  const parseWarnings: string[] = []

  try {
    const hostMatches = Array.from(xmlContent.matchAll(/<host[\s>]([\s\S]*?)<\/host>/g))

    for (const hostMatch of hostMatches) {
      try {
        const hostXml = hostMatch[1]

        const ipMatch = hostXml.match(/addr="([^"]+)" addrtype="ipv4"/)
          ?? hostXml.match(/addr="([^"]+)" addrtype="ipv6"/)
        const ip = ipMatch?.[1]

        const hostnameMatch = hostXml.match(/<hostname name="([^"]+)"/)
        const hostname = hostnameMatch?.[1] ?? ip

        const portMatches = Array.from(hostXml.matchAll(/<port protocol="[^"]*" portid="(\d+)">([\s\S]*?)<\/port>/g))

        for (const portMatch of portMatches) {
          try {
            const portNum = parseInt(portMatch[1], 10)
            const portXml = portMatch[2]

            const stateMatch = portXml.match(/state="([^"]+)"/)
            if (stateMatch?.[1] !== "open") continue

            const serviceMatch = portXml.match(/name="([^"]+)"/)
            const serviceProduct = portXml.match(/product="([^"]+)"/)
            const serviceVersion = portXml.match(/version="([^"]+)"/)

            const serviceName = serviceMatch?.[1] ?? "unknown"
            const product = serviceProduct?.[1] ?? ""
            const version = serviceVersion?.[1] ?? ""

            const scripts = Array.from(portXml.matchAll(/<script\b([^>]*?)(?:\/>|>)/g))
              .map((sm) => {
                const attrs = sm[1]
                const id = attrs.match(/\bid="([^"]*)"/)?.[1]
                const output = attrs.match(/\boutput="([^"]*)"/)?.[1] ?? ""
                return id ? { id, output } : null
              })
              .filter((s): s is { id: string; output: string } => s !== null)

            const vulnScripts = scripts.filter(
              (s) =>
                s.id.includes("vuln") ||
                s.id.includes("exploit") ||
                s.id.includes("brute") ||
                s.id.includes("default")
            )

            if (vulnScripts.length > 0) {
              for (const script of vulnScripts) {
                const severity = cvssFromScript(script.output)
                const cveMatch = script.output.match(/CVE-\d{4}-\d+/g)
                findings.push({
                  title: `${script.id} on ${hostname}:${portNum}`,
                  description: script.output.slice(0, 2000),
                  severity,
                  host: hostname ?? ip,
                  port: portNum,
                  cveIds: cveMatch?.join(", "),
                  source: "nmap",
                })
              }
            } else if (product || version) {
              findings.push({
                title: `Open port ${portNum}/${serviceName} on ${hostname}`,
                description: `${product} ${version}`.trim() || `Service: ${serviceName}`,
                severity: "info",
                host: hostname ?? ip,
                port: portNum,
                source: "nmap",
              })
            }
          } catch (e) {
            parseWarnings.push(`Skipped port in host ${ip}: ${String(e)}`)
          }
        }
      } catch (e) {
        parseWarnings.push(`Skipped malformed host entry: ${String(e)}`)
      }
    }

    if (findings.length === 0) {
      parseWarnings.push(
        "No open ports or vulnerability scripts found. Ensure the file is an nmap XML export (-oX flag)."
      )
    }
  } catch (e) {
    parseWarnings.push(`Failed to parse nmap XML: ${String(e)}`)
  }

  return { findings, parseWarnings }
}
