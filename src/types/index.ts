export type Severity = "critical" | "high" | "medium" | "low" | "info"
export type ObservationStatus = "raw" | "promoted" | "archived"
export type EngagementStatus = "active" | "closing" | "complete"
export type IngestSource = "manual" | "burp" | "nmap" | "nuclei" | "nessus" | "metasploit" | "threatassessor"

export type SspProfile =
  | "low_risk_cloud"
  | "medium_risk_cloud"
  | "high_risk_cloud"
  | "on_premises"
  | "generative_ai"
  | "digital_services"
  | "sandbox"

export const SSP_LEVEL_LABELS = {
  L0: "Cardinal — mandatory, cannot defer without executive sign-off",
  L1: "Basic Hygiene — strongly recommended",
  L2: "Best Practice — risk-accepted deferral possible",
} as const

export interface User {
  id: string
  email: string
  name?: string | null
  houseStyle?: string | null
  createdAt: Date
}

export interface Engagement {
  id: string
  name: string
  clientName: string
  clientBrief?: string | null
  scope?: string | null
  startDate: Date
  endDate?: Date | null
  status: EngagementStatus
  userId: string
  createdAt: Date
  updatedAt: Date
  sspProfile?: string | null
  threatModelRunAt?: Date | null
  architectureName?: string | null
}

export interface Observation {
  id: string
  content: string
  source: IngestSource
  host?: string | null
  status: ObservationStatus
  engagementId: string
  findingId?: string | null
  createdAt: Date
  mitreIds?: string | null
  mitreMitigations?: string | null
  sspControls?: string | null
  taConfidence?: number | null
  attackPath?: string | null
}

export interface Finding {
  id: string
  title: string
  description: string
  severity: Severity
  cvss?: number | null
  host?: string | null
  port?: number | null
  evidence?: string | null
  remediationNote?: string | null
  cveIds?: string | null
  source: IngestSource
  engagementId: string
  createdAt: Date
  updatedAt: Date
  mitreIds?: string | null
  mitreMitigations?: string | null
  sspControls?: string | null
  taConfidence?: number | null
  attackPath?: string | null
}

export interface ParsedFinding {
  title: string
  description: string
  severity: Severity
  host?: string
  port?: number
  cvss?: number
  cveIds?: string
  evidence?: string
  source: IngestSource
  rawData?: Record<string, unknown>
  // ThreatAssessor-specific fields (optional on base type, populated by TA parser)
  mitreIds?: string
  mitreMitigations?: string
  sspControls?: string
  taConfidence?: number
  attackPath?: string
}

export interface ParseResult {
  findings: ParsedFinding[]
  parseWarnings: string[]
}

export type DeduplicationAction = "merge" | "keep_both" | "mark_distinct"

export interface DuplicateCandidate {
  incoming: ParsedFinding
  existing: Finding
  similarity: number
  matchReasons: string[]
}

export interface DeduplicationDecision {
  candidate: DuplicateCandidate
  action: DeduplicationAction
}

export interface FindingChainLink {
  from: string
  to: string
  explanation: string
}
