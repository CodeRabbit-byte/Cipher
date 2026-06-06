import type { ParsedFinding, Severity, SspProfile } from "@/types"

export const SSP_PROFILES = [
  "low_risk_cloud",
  "medium_risk_cloud",
  "high_risk_cloud",
  "on_premises",
  "generative_ai",
  "digital_services",
  "sandbox",
] as const

export const SSP_PROFILE_LABELS: Record<SspProfile, string> = {
  low_risk_cloud: "Low Risk Cloud",
  medium_risk_cloud: "Medium Risk Cloud",
  high_risk_cloud: "High Risk Cloud",
  on_premises: "On-Premises",
  generative_ai: "Generative AI",
  digital_services: "Digital Services",
  sandbox: "Sandbox",
}

function normaliseSeverity(raw: string): Severity {
  const s = (raw ?? "").toLowerCase().trim()
  if (s === "critical") return "critical"
  if (s === "high") return "high"
  if (s === "medium" || s === "moderate") return "medium"
  if (s === "low") return "low"
  return "info"
}

function severityFromRiskScore(score: number): Severity {
  if (score >= 25) return "critical"
  if (score >= 18) return "high"
  if (score >= 10) return "medium"
  if (score >= 5) return "low"
  return "info"
}

// ──────────────────────────────────────────────────────────────────────────────
// NOTE: Field names below are derived from the ThreatAssessor Medium article,
// OpenAPI spec v1.3.0, and the after.mmd annotation examples. They may not
// match the actual ground_truth.json structure.
//
// BEFORE SHIPPING: Run the Step 0d curl test, inspect /tmp/ta_ground_truth.json
// and /tmp/ta_real_response.json, then update every TODO-FIELDNAME comment with
// the real field name you observe.
// ──────────────────────────────────────────────────────────────────────────────

export interface TAParsedFinding extends ParsedFinding {
  mitreIds: string
  mitreMitigations: string
  sspControls: string
  taConfidence: number
  attackPath: string
}

/**
 * Parse ground_truth.json (preferred) into CIPHER ParsedFinding objects.
 * Field names are placeholders — update after Step 0d inspection.
 */
export function parseThreatAssessorGroundTruth(
  groundTruth: Record<string, unknown>,
  sspProfile: SspProfile
): { findings: TAParsedFinding[]; parseWarnings: string[] } {
  const warnings: string[] = []
  const findings: TAParsedFinding[] = []

  // TODO-FIELDNAME: replace 'attack_paths' with the actual key from ground_truth.json
  const attackPaths =
    (groundTruth["attack_paths"] ??
      groundTruth["paths"] ??
      groundTruth["findings"] ??
      groundTruth["threats"]) as Array<Record<string, unknown>> | undefined

  if (!Array.isArray(attackPaths) || attackPaths.length === 0) {
    warnings.push(
      "PLACEHOLDER PARSER: Could not locate attack paths array in ground_truth.json. " +
        "Run the curl test from Step 0d, inspect /tmp/ta_ground_truth.json, and update " +
        "parseThreatAssessorGroundTruth() with the real field name."
    )
    return { findings, parseWarnings: warnings }
  }

  for (const path of attackPaths) {
    try {
      // TODO-FIELDNAME: update these field names after inspecting ground_truth.json
      const title = String(
        path["name"] ?? path["title"] ?? path["description"] ?? "Unnamed attack path"
      )
      const description = String(path["detail"] ?? path["description"] ?? path["summary"] ?? "")
      const riskScore = Number(path["risk_score"] ?? path["score"] ?? path["cvss"] ?? 0)

      // TODO-FIELDNAME: update technique field names
      const rawTechniques = (path["techniques"] ?? path["mitre_techniques"] ?? path["technique_ids"] ?? []) as string[]
      const techniques = Array.isArray(rawTechniques) ? rawTechniques : []

      // TODO-FIELDNAME: update mitigation/control field names
      const rawMitigations = (path["mitigations"] ?? path["controls"] ?? path["recommendations"] ?? []) as Array<Record<string, unknown>>
      const mitigations = Array.isArray(rawMitigations) ? rawMitigations : []

      // TODO-FIELDNAME: update path description field name
      const pathDescription = String(path["path"] ?? path["attack_path"] ?? path["chain"] ?? "")

      const confidence = Number(path["confidence"] ?? 0.995)

      let severity: Severity
      if (typeof path["severity"] === "string") {
        severity = normaliseSeverity(path["severity"] as string)
      } else {
        severity = severityFromRiskScore(riskScore)
      }

      // Extract SSP control IDs for the selected profile
      // TODO-FIELDNAME: update SSP control extraction after inspecting ground_truth.json
      const sspControlIds = mitigations
        .map((m) => {
          const ssp = m["ssp"] ?? m["ssp_controls"] ?? m["compliance"] ?? ""
          if (typeof ssp === "string") return ssp
          const profileControls = (ssp as Record<string, unknown>)[sspProfile]
          if (Array.isArray(profileControls)) return profileControls.join(",")
          return String(profileControls ?? "")
        })
        .filter(Boolean)
        .join(",")

      const mitigationIds = mitigations
        .map((m) => String(m["mitre_id"] ?? m["id"] ?? m["mitigation_id"] ?? ""))
        .filter(Boolean)
        .join(",")

      findings.push({
        title: title.trim().slice(0, 500),
        description: description.trim().slice(0, 5000),
        severity,
        host: undefined,
        port: undefined,
        source: "threatassessor",
        mitreIds: techniques.join(","),
        mitreMitigations: mitigationIds,
        sspControls: sspControlIds,
        taConfidence: confidence,
        attackPath: pathDescription.trim().slice(0, 1000),
      } as TAParsedFinding)
    } catch (e) {
      warnings.push(`Skipped malformed attack path: ${String(e)}`)
    }
  }

  if (findings.length === 0) {
    warnings.push(
      "Parsed 0 findings from ground_truth.json. " +
        "Check that the attack_paths field name matches the actual response."
    )
  }

  return { findings, parseWarnings: warnings }
}

/**
 * Parse the AnalyzeResponse.data freeform object as a fallback when
 * ground_truth.json is unavailable.
 * Field names are placeholders — update after Step 0d inspection.
 */
export function parseThreatAssessorResponseData(
  data: Record<string, unknown>,
  sspProfile: SspProfile
): { findings: TAParsedFinding[]; parseWarnings: string[] } {
  const warnings: string[] = [
    "Using AnalyzeResponse.data (fallback). ground_truth.json is preferred — check ThreatAssessor reports endpoint.",
  ]

  // The AnalyzeResponse.data shape may be identical to ground_truth.json
  // or it may be a summary object. Try the same parser first.
  const result = parseThreatAssessorGroundTruth(data, sspProfile)
  result.parseWarnings = [...warnings, ...result.parseWarnings]
  return result
}

/**
 * Parse 07_moe_orchestrator.json — the MoE consensus object.
 * Returns metadata for purple team prompt and confidence display.
 * Field names are placeholders — update after Step 0d inspection.
 */
export function parseMoEOrchestrator(orchestrator: Record<string, unknown>): {
  confidenceCascade: {
    base: number
    architectAdjustment: number
    testerAdjustment: number
    redTeamAdjustment: number
    final: number
    interpretation: string
  } | null
  blindspots: string[]
  contradictions: string[]
  redTeamRoadmap: Array<{
    tier: "quick_win" | "recommended" | "maximum"
    control: string
    effort: string
    cost: string
    residualRiskAfter: number
  }>
  criticalFindings: string[]
  highFindings: string[]
} {
  // TODO-FIELDNAME: update all field names after inspecting 07_moe_orchestrator.json
  const cascade = orchestrator["confidence"] as Record<string, unknown> | undefined

  return {
    confidenceCascade: cascade
      ? {
          base: Number(cascade["base"] ?? cascade["base_score"] ?? 0),
          architectAdjustment: Number(cascade["architect_adjustment"] ?? cascade["architect"] ?? 0),
          testerAdjustment: Number(cascade["tester_adjustment"] ?? cascade["tester"] ?? 0),
          redTeamAdjustment: Number(cascade["red_team_adjustment"] ?? cascade["red_team"] ?? 0),
          final: Number(cascade["final"] ?? cascade["final_score"] ?? 0),
          interpretation: String(cascade["interpretation"] ?? cascade["label"] ?? ""),
        }
      : null,
    blindspots: ((orchestrator["blindspots"] ?? orchestrator["blind_spots"] ?? []) as string[]),
    contradictions: ((orchestrator["contradictions"] ?? []) as string[]),
    redTeamRoadmap: ((
      orchestrator["exploit_mitigation_roadmap"] ??
      orchestrator["red_team_roadmap"] ??
      orchestrator["roadmap"] ??
      []
    ) as Array<Record<string, unknown>>).map((item) => ({
      tier: (String(item["tier"] ?? "recommended") as "quick_win" | "recommended" | "maximum"),
      control: String(item["control"] ?? item["mitigation"] ?? ""),
      effort: String(item["effort"] ?? ""),
      cost: String(item["cost"] ?? item["estimated_cost"] ?? ""),
      residualRiskAfter: Number(item["residual_risk_after"] ?? item["residual_risk"] ?? 0),
    })),
    criticalFindings: ((orchestrator["critical"] ?? orchestrator["critical_findings"] ?? []) as string[]),
    highFindings: ((orchestrator["high"] ?? orchestrator["high_findings"] ?? []) as string[]),
  }
}
