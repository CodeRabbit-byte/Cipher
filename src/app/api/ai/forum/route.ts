import { NextRequest } from "next/server"
import { streamText } from "ai"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { getModel, getProviderStatus } from "@/lib/ai/provider"
import { z } from "zod"

const ContextItemSchema = z.object({
  type: z.enum(["observation", "finding", "threatmodel", "cve"]),
  id: z.string(),
  label: z.string(),
  // Cap individual content items to prevent prompt stuffing
  content: z.string().max(20000),
  severity: z.string().optional(),
})

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  // Cap per-message content
  content: z.string().max(10000),
})

const BodySchema = z.object({
  engagementId: z.string(),
  messages: z.array(MessageSchema).min(1).max(50),
  contextItems: z.array(ContextItemSchema).max(20).default([]),
})

// ---------------------------------------------------------------------------
// In-memory per-user rate limiter for the AI forum endpoint
// Allows at most FORUM_MAX_REQUESTS per FORUM_WINDOW_MS per user.
// ---------------------------------------------------------------------------
const FORUM_WINDOW_MS = 60 * 1000 // 1 minute
const FORUM_MAX_REQUESTS = 20

const forumRequests = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = forumRequests.get(userId)
  if (!entry || now - entry.windowStart > FORUM_WINDOW_MS) {
    forumRequests.set(userId, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  if (entry.count > FORUM_MAX_REQUESTS) return true
  return false
}

// Maximum total context content characters
const MAX_CONTEXT_CHARS = 100000

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  if (isRateLimited(session.user.id)) {
    return new Response("Too many requests. Please slow down.", { status: 429 })
  }

  const { configured } = getProviderStatus()
  if (!configured) {
    // Do not disclose the provider name to clients
    return new Response("AI features are not currently available.", { status: 503 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return new Response("Invalid input", { status: 400 })

  const { engagementId, messages, contextItems } = parsed.data

  // Enforce total context size cap
  const totalContextChars = contextItems.reduce((sum, item) => sum + item.content.length, 0)
  if (totalContextChars > MAX_CONTEXT_CHARS) {
    return new Response("Context too large", { status: 400 })
  }

  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, userId: session.user.id },
    select: { name: true, clientName: true, clientBrief: true },
  })
  if (!engagement) return new Response("Not found", { status: 404 })

  const contextBlock =
    contextItems.length > 0
      ? `\n\n## Selected context\n\n${contextItems
          .map((item) => {
            if (item.type === "finding") {
              return `### Finding [${item.severity?.toUpperCase() ?? "?"}]: ${item.label}\n${item.content}`
            }
            if (item.type === "threatmodel") {
              return `### Threat Model Context: ${item.label}\n${item.content}`
            }
            if (item.type === "cve") {
              return `### CVE Record: ${item.label}\n${item.content}`
            }
            return `### Observation: ${item.label}\n${item.content}`
          })
          .join("\n\n---\n\n")}`
      : ""

  const systemPrompt = `You are a senior penetration tester, threat intelligence analyst, and defensive security specialist embedded in an active security engagement. You produce professional, technically precise, evidence-grounded analysis.

Engagement: ${engagement.name}
Client: ${engagement.clientName}${engagement.clientBrief ? `\nBrief: ${engagement.clientBrief}` : ""}${contextBlock}

---

## Output Format
Always respond in well-structured Markdown:
- Use ## / ### section headers to organise content
- Use fenced code blocks with language hints for all commands, payloads, and config (e.g. \`\`\`bash, \`\`\`json)
- Use tables for finding summaries, MITRE mappings, and control comparisons
- Use **bold** for critical terms and findings
- Use > blockquotes for unconfirmed hypotheses or assumptions

## CVE Citation Standard
When referencing CVEs:
- Format: **CVE-YYYY-NNNNN** (CVSS vN score X.X — affected component/version) — brief description
- Only cite CVEs you are highly confident are correctly attributed. If uncertain, describe the vulnerability class and say "verify against NVD: https://nvd.nist.gov/vuln/detail/CVE-XXXX-XXXXX" rather than guessing
- Include CVSS v3.1 base score and vector string when known

## MITRE ATT&CK References
- Format: **TXXXX** [Tactic — Technique Name] e.g. **T1190** [Initial Access — Exploit Public-Facing Application]
- Sub-techniques: **T1078.004** [Persistence — Valid Accounts: Cloud Accounts]
- Reference: https://attack.mitre.org/techniques/TXXXX/

## Defense & Remediation References
For every control or remediation step, cite at least one authoritative source:
- **NIST SP 800-53 Rev5**: include control ID and name (e.g. SI-3 Malicious Code Protection, AC-6 Least Privilege, AU-12 Audit Record Generation)
- **CIS Controls v8**: include safeguard number (e.g. CIS 7.3 Perform Automated OS Patch Management, CIS 4.1 Establish Secure Configurations)
- **OWASP**: Top 10 2021 category, ASVS level, or Testing Guide section (e.g. OWASP A05:2021 Security Misconfiguration, OWASP ASVS 4.0 Level 2)
- **Vendor hardening guides**: AWS Security Best Practices, Azure Security Benchmark, GCP Security Foundations Blueprint, CIS Benchmarks for specific products
- **SANS training** where relevant: include course code and name (e.g. SANS SEC560 Enterprise Penetration Testing, SANS SEC530 Defensible Security Architecture)
- **NIST SPs and FIPS** for cryptographic and compliance guidance (e.g. NIST SP 800-61 Incident Handling, NIST SP 800-92 Log Management)

## Accuracy Rules
- Label attack paths **[THEORETICAL]** if unvalidated, **[CONFIRMED]** if the engagement has evidence
- Never fabricate CVE numbers — describe the vulnerability class accurately and direct verification to NVD
- Distinguish what is inferrable from the architecture context versus what requires live testing
- Include specific, runnable evidence-collection commands (nmap, curl, aws cli, az cli, etc.) for every claimed attack path
- Severity ratings must follow CVSS v3.1 methodology — justify the score with the relevant CVSS vector components

## Your Objectives
- Expand observations into full exploitation chains: root cause → attack vector → lateral movement → impact
- Identify detection and response gaps: missing logging, no EDR, no rate limiting, inadequate alerting
- Map every finding to MITRE ATT&CK, OWASP Top 10, and applicable NIST SP 800-53 / CIS Controls
- Recommend concrete, prioritised remediation with vendor documentation links and benchmark references
- For each defensive control gap, recommend specific training resources (SANS courses, vendor certifications, NIST guidance docs, OWASP resources)
- Estimate severity with CVSS v3.1, justify the score, and flag if any provided rating appears miscalibrated

Be direct, specific, and technical. Tie every claim to the provided context — generic advice without grounding in the engagement details is not acceptable.`

  try {
    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
      maxOutputTokens: 4000,
      temperature: 0.3,
    })
    return result.toTextStreamResponse()
  } catch (e) {
    // Log the full error server-side; never expose internal details to the client
    console.error("[ai/forum] provider error:", e)
    return new Response("AI service temporarily unavailable.", { status: 500 })
  }
}
