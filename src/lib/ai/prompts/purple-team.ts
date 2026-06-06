import type { Finding, FindingChainLink, SspProfile } from "@/types"
import { SSP_PROFILE_LABELS } from "@/lib/parsers/threatassessor"
import { parseMoEOrchestrator } from "@/lib/parsers/threatassessor"

// Fetch the MoE orchestrator file from ThreatAssessor (best-effort, never throws).
async function fetchMoEOrchestrator(
  architectureName: string,
  baseUrl: string,
  apiKey: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/reports/${architectureName}/files/07_moe_orchestrator.json`,
      {
        headers: { "TM-API-KEY": apiKey },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function buildPurpleTeamPrompt(
  params: {
    clientName: string
    clientBrief: string
    scope: string | null
    findings: Finding[]
    findingChain: FindingChainLink[]
    engagementDuration: string
    sspProfile?: string | null
    architectureName?: string | null
  },
  perspective: "red" | "blue"
): Promise<{ system: string; user: string }> {
  const criticalAndHigh = params.findings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  )

  const allFindingsSummary = params.findings
    .map(
      (f) =>
        `- [${f.severity.toUpperCase()}] ${f.title}${f.host ? ` on ${f.host}` : ""}${f.port ? `:${f.port}` : ""}${f.cvss ? ` (CVSS ${f.cvss})` : ""}${f.cveIds ? ` [${f.cveIds}]` : ""}${f.mitreIds ? ` {MITRE: ${f.mitreIds}}` : ""}${f.description ? `\n  Description: ${f.description}` : ""}${f.evidence ? `\n  Evidence: ${f.evidence}` : ""}${f.remediationNote ? `\n  Remediation note: ${f.remediationNote}` : ""}`
    )
    .join("\n")

  const chainsSummary =
    params.findingChain.length > 0
      ? params.findingChain
          .map((c) => `- ${c.from} → ${c.to}: ${c.explanation}`)
          .join("\n")
      : "No chained findings identified."

  const findingContext = `CLIENT: ${params.clientName}
CLIENT CONTEXT: ${params.clientBrief}
SCOPE: ${params.scope ?? "Not specified"}
ENGAGEMENT DURATION: ${params.engagementDuration}

CRITICAL AND HIGH FINDINGS (${criticalAndHigh.length}):
${
  criticalAndHigh.length > 0
    ? criticalAndHigh
        .map(
          (f) =>
            `- [${f.severity.toUpperCase()}] ${f.title}${f.host ? ` on ${f.host}` : ""}${f.port ? `:${f.port}` : ""}${f.cvss ? ` (CVSS ${f.cvss})` : ""}${f.cveIds ? ` [${f.cveIds}]` : ""}${f.mitreIds ? ` {MITRE: ${f.mitreIds}}` : ""}`
        )
        .join("\n")
    : "None."
}

ALL FINDINGS:
${allFindingsSummary || "No findings recorded."}

FINDING CHAINS (compounding attack paths):
${chainsSummary}`

  // ── ThreatAssessor MoE context (best-effort) ────────────────────────────
  let moeContext = ""
  let sspContext = ""

  const taUrl = (process.env.THREATASSESSOR_URL ?? "http://localhost:8000").replace(/\/$/, "")
  const taKey = process.env.THREATASSESSOR_API_KEY ?? ""

  if (params.architectureName && taKey) {
    const raw = await fetchMoEOrchestrator(params.architectureName, taUrl, taKey)
    if (raw) {
      const moe = parseMoEOrchestrator(raw)
      const lines: string[] = ["THREAT MODEL CONTEXT (from ThreatAssessor Red Team critic):"]

      if (moe.confidenceCascade) {
        const cc = moe.confidenceCascade
        lines.push(
          `ThreatAssessor confidence cascade: ${(cc.base * 100).toFixed(1)}% (base) → ${(cc.final * 100).toFixed(1)}% (final${cc.interpretation ? `, ${cc.interpretation}` : ""})`
        )
        if (cc.redTeamAdjustment !== 0) {
          lines.push(
            `Red Team adjustment: ${cc.redTeamAdjustment > 0 ? "+" : ""}${(cc.redTeamAdjustment * 100).toFixed(1)}%`
          )
        }
      }

      if (moe.blindspots.length > 0) {
        lines.push("", "Blindspots identified by all three critics:")
        moe.blindspots.slice(0, 8).forEach((b) => lines.push(`- ${b}`))
      }

      if (moe.contradictions.length > 0) {
        lines.push("", "Contradictions between critics:")
        moe.contradictions.slice(0, 5).forEach((c) => lines.push(`- ${c}`))
      }

      if (moe.redTeamRoadmap.length > 0) {
        lines.push("", "Red Team exploit mitigation roadmap:")
        moe.redTeamRoadmap.slice(0, 6).forEach((r) => {
          lines.push(
            `- [${r.tier.replace("_", " ").toUpperCase()}] ${r.control} — effort: ${r.effort}, cost: ${r.cost}`
          )
        })
      }

      moeContext = lines.join("\n")
    }
  }

  if (params.sspProfile && SSP_PROFILE_LABELS[params.sspProfile as SspProfile]) {
    const profileLabel = SSP_PROFILE_LABELS[params.sspProfile as SspProfile]

    const addressedControls = new Set(
      params.findings.flatMap((f) =>
        f.sspControls
          ? f.sspControls.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      )
    )

    const l0Unaddressed = [...addressedControls].filter(
      (c) => c.includes("L0") && !params.findings.some((f) => f.sspControls?.includes(c))
    )

    const l0Lines = l0Unaddressed.slice(0, 10).map((c) => `- ${c}`)

    if (l0Lines.length > 0) {
      sspContext = [
        `SSP COMPLIANCE CONTEXT: Profile: ${profileLabel}`,
        "L0 mandatory controls NOT YET ADDRESSED by confirmed findings:",
        ...l0Lines,
        "These are non-deferrable under the SSP baseline.",
      ].join("\n")
    }
  }

  if (perspective === "red") {
    const system = `You are a senior threat actor analyst with nation-state APT experience. You have been given a penetration test report. Think like a real attacker who just received this intelligence. Your job is to identify the most dangerous attack paths, how findings chain together into compromise scenarios, what a motivated attacker could realistically achieve, and how hard this would be to detect. Be specific to the findings — never give generic advice. Reference MITRE ATT&CK techniques where relevant. Be direct and technical — you are briefing a red team lead, not a client.`

    const user = `Analyse the following penetration test findings from an attacker's perspective.

${findingContext}
${moeContext ? "\n" + moeContext : ""}

Produce your analysis under these exact sections using markdown headers and bullet points:

## CRITICAL ATTACK PATH
The single most dangerous chain of findings — step by step how an attacker moves from initial access to their objective. Name specific findings at each step. Reference relevant MITRE ATT&CK technique IDs (e.g. T1190, T1078) inline.

## SECONDARY SCENARIOS
2–3 additional attack scenarios using different combinations of findings. For each scenario: name it, list the findings involved, describe the attack flow, and note the likely objective.

## ATTACKER ADVANTAGE
What makes this environment attractive to a motivated attacker — data and systems at risk, lateral movement opportunities, persistence options, and any factors that increase attacker leverage.

## DETECTION DIFFICULTY
For each major attack path identified above, assess how hard it would be to detect. What telemetry gaps exist? What log sources or detections would catch it? What would an attacker do to stay quiet?

## ESTIMATED TIME TO IMPACT
Realistic attacker timeline from initial access to achieving their primary objective. Break this into phases (e.g. initial access, foothold, lateral movement, objective). Note what could accelerate or slow the timeline.`

    return { system, user }
  }

  // perspective === "blue"
  const system = `You are a defensive security architect and incident response specialist. You have been given a penetration test report showing real vulnerabilities in a client environment. Your job is to build a layered defensive strategy: immediate actions, strategic fixes, detection and monitoring controls, fallback mitigations if primary fixes are delayed, and incident response preparation. Prioritise ruthlessly by risk reduction per effort. Be specific to the findings — reference specific controls, tools, and configurations. Write for a security operations team lead.`

  const user = `Analyse the following penetration test findings and build a defensive response strategy.

${findingContext}
${sspContext ? "\n" + sspContext : ""}

Produce your analysis under these exact sections using markdown headers and bullet points:

## IMMEDIATE ACTIONS (0–48 hours)
Quick wins that reduce risk now — no deployment required, just configuration changes, access revocations, rule updates, or emergency patches. Numbered list. For each action state: what to do, which finding(s) it addresses, and expected risk reduction.

## SHORT-TERM FIXES (1–4 weeks)
Proper remediations per finding, prioritised by severity and exploitability. For each fix: the target finding, the specific remediation (including relevant tools, configurations, or patches), and any dependencies or caveats.

## DETECTION & MONITORING
Specific log sources, SIEM rules, and alerts to implement for each major finding. For each: what to instrument, the detection logic or query pattern, and what an active exploitation attempt looks like in the logs.

## DEFENCE-IN-DEPTH
If primary remediations take time, what compensating controls reduce exposure in the interim. Layered architecture recommendations: network segmentation, access controls, egress filtering, endpoint hardening. Map controls to the findings they mitigate.

## INCIDENT RESPONSE PREP
If these findings are already being exploited — indicators of compromise to hunt for right now, containment steps to take immediately, and evidence to preserve for forensic investigation. Include specific file paths, registry keys, log entries, or network indicators relevant to the findings.`

  return { system, user }
}
