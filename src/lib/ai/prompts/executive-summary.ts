import type { Finding, FindingChainLink, SspProfile } from "@/types"
import { SSP_PROFILE_LABELS } from "@/lib/parsers/threatassessor"

// Resolve MITRE technique IDs to names via ThreatAssessor.
// Returns a map of ID → name. Silently falls back to IDs-only on any error.
async function resolveMitreTechniques(
  ids: string[],
  baseUrl: string,
  apiKey: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (!ids.length) return result
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/techniques?technique_ids=${ids.join(",")}`,
      {
        headers: { "TM-API-KEY": apiKey },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return result
    const data = (await res.json()) as { techniques?: Record<string, string> }
    if (data.techniques) {
      for (const [id, name] of Object.entries(data.techniques)) {
        result.set(id, name)
      }
    }
  } catch { /* ThreatAssessor unreachable — use IDs only */ }
  return result
}

export async function buildExecutiveSummaryPrompt(params: {
  clientName: string
  clientBrief: string
  findings: Finding[]
  findingChain: FindingChainLink[]
  houseStyle: string
  engagementDuration: string
  sspProfile?: string | null
  architectureName?: string | null
  taObservationCounts?: { confirmed: number; total: number } | null
}): Promise<{ system: string; user: string }> {
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

  // ── Section A: MITRE ATT&CK chain ──────────────────────────────────────
  let mitreSectionLines: string[] = []
  const allMitreIds = params.findings
    .flatMap((f) => (f.mitreIds ? f.mitreIds.split(",").map((s) => s.trim()).filter(Boolean) : []))
  const uniqueMitreIds = [...new Set(allMitreIds)]

  if (uniqueMitreIds.length > 0) {
    const taUrl = (process.env.THREATASSESSOR_URL ?? "http://localhost:8000").replace(/\/$/, "")
    const taKey = process.env.THREATASSESSOR_API_KEY ?? ""
    const nameMap = taKey
      ? await resolveMitreTechniques(uniqueMitreIds, taUrl, taKey)
      : new Map<string, string>()

    // Build ID → finding titles
    const idToFindings = new Map<string, string[]>()
    for (const finding of params.findings) {
      if (!finding.mitreIds) continue
      for (const id of finding.mitreIds.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!idToFindings.has(id)) idToFindings.set(id, [])
        idToFindings.get(id)!.push(finding.title)
      }
    }

    mitreSectionLines = [
      "MITRE ATT&CK TECHNIQUES IDENTIFIED:",
      ...uniqueMitreIds.map((id) => {
        const name = nameMap.get(id)
        const findings = idToFindings.get(id) ?? []
        return `- ${id}${name ? ` — ${name}` : ""} (${findings.join(", ")})`
      }),
    ]
  }

  // ── Section B: SSP compliance gaps ─────────────────────────────────────
  let sspSectionLines: string[] = []
  if (params.sspProfile && SSP_PROFILE_LABELS[params.sspProfile as SspProfile]) {
    const profileLabel = SSP_PROFILE_LABELS[params.sspProfile as SspProfile]

    // Collect all addressed SSP control IDs
    const addressedControls = new Set(
      params.findings.flatMap((f) =>
        f.sspControls
          ? f.sspControls.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      )
    )

    // Collect all predicted SSP controls from TA observations (via findings)
    const allSspControls = [...addressedControls]

    if (allSspControls.length > 0) {
      const l0 = allSspControls.filter((c) => c.includes("L0"))
      const l1 = allSspControls.filter((c) => c.includes("L1"))

      const formatControl = (control: string) => {
        const addressed = addressedControls.has(control) ? "ADDRESSED" : "NOT ADDRESSED"
        const findingTitles = params.findings
          .filter((f) => f.sspControls?.includes(control))
          .map((f) => f.title)
          .slice(0, 2)
        return `- ${control}: ${addressed}${findingTitles.length ? ` — "${findingTitles.join('", "')}"` : ""}`
      }

      sspSectionLines = [
        `SSP COMPLIANCE PROFILE: ${profileLabel}`,
        ...(l0.length > 0
          ? ["Mandatory controls (L0):", ...l0.map(formatControl)]
          : []),
        ...(l1.length > 0
          ? ["Recommended controls (L1):", ...l1.map(formatControl)]
          : []),
      ]
    }
  }

  // ── Section C: Coverage delta ───────────────────────────────────────────
  let coverageSectionLines: string[] = []
  if (params.taObservationCounts && params.taObservationCounts.total > 0) {
    const { confirmed, total } = params.taObservationCounts
    const notConfirmed = total - confirmed
    coverageSectionLines = [
      "THREAT MODEL COVERAGE:",
      `- ${confirmed} of ${total} predicted attack paths were confirmed during testing`,
      ...(notConfirmed > 0
        ? [`- ${notConfirmed} predicted path${notConfirmed !== 1 ? "s" : ""} were not confirmed (untested, out of scope, or accepted risk)`]
        : []),
      "Note: Unconfirmed paths do not mean they are safe — they mean they were not tested.",
    ]
  }

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
${mitreSectionLines.length > 0 ? "\n" + mitreSectionLines.join("\n") : ""}
${sspSectionLines.length > 0 ? "\n" + sspSectionLines.join("\n") : ""}
${coverageSectionLines.length > 0 ? "\n" + coverageSectionLines.join("\n") : ""}

Write the executive summary now. Do not include section headers. Prose only.`

  return { system, user }
}
