import type { Finding, FindingChainLink } from "@/types"

export function buildExecutiveSummaryPrompt(params: {
  clientName: string
  clientBrief: string
  findings: Finding[]
  findingChain: FindingChainLink[]
  houseStyle: string
  engagementDuration: string
}): { system: string; user: string } {
  const criticalAndHigh = params.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  )

  const system = `You are a senior penetration testing consultant writing an executive summary for a security engagement report.

Your output will be sent directly to a client. It must meet these standards:
- Written for a non-technical executive reader — no jargon without explanation
- Narrative-first: tell the story of what was found and what it means for this specific client
- Severity in context: a finding's real risk depends on the client's environment, not just its CVSS score
- Never use the phrase "confidentiality, integrity, and availability" — it reads as boilerplate
- Never start with "This engagement identified" or "During this assessment"
- Match the tone and register of the house style provided
- Length: 3–5 paragraphs. No bullet points in the executive summary.
- End with a single clear recommendation sentence about the most important next step

House style: ${params.houseStyle || "Professional and direct. No corporate filler. Write as a trusted advisor, not a vendor."}`

  const user = `Write an executive summary for the following engagement.

CLIENT: ${params.clientName}
CLIENT CONTEXT: ${params.clientBrief}
ENGAGEMENT DURATION: ${params.engagementDuration}

CRITICAL AND HIGH FINDINGS (${criticalAndHigh.length}):
${criticalAndHigh
  .map(
    (f) =>
      `- [${f.severity.toUpperCase()}] ${f.title}${f.host ? ` on ${f.host}` : ""}${f.remediationNote ? ` — Remediation note: ${f.remediationNote}` : ""}`
  )
  .join("\n")}

ALL FINDINGS SUMMARY:
${params.findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title}`).join("\n")}

FINDING CHAINS (compounding risks):
${
  params.findingChain.length > 0
    ? params.findingChain
        .map((c) => `- ${c.from} → ${c.to}: ${c.explanation}`)
        .join("\n")
    : "No chained findings identified."
}

Write the executive summary now. Do not include section headers. Prose only.`

  return { system, user }
}
