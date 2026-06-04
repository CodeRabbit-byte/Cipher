import type { Finding, ParsedFinding, DuplicateCandidate } from "@/types"

const VULN_CLASS_ALIASES: Record<string, string> = {
  "sql injection": "sqli",
  sqli: "sqli",
  "cross-site scripting": "xss",
  xss: "xss",
  "remote code execution": "rce",
  rce: "rce",
  "command injection": "cmdi",
  "path traversal": "traversal",
  "directory traversal": "traversal",
  "open redirect": "redirect",
  "ssrf": "ssrf",
  "server-side request forgery": "ssrf",
  "xxe": "xxe",
  "xml external entity": "xxe",
  "broken authentication": "authn",
  "weak authentication": "authn",
  "insecure deserialization": "deser",
  "csrf": "csrf",
  "cross-site request forgery": "csrf",
  "idor": "idor",
  "insecure direct object reference": "idor",
  "privilege escalation": "privesc",
  "default credentials": "defaultcreds",
  "default password": "defaultcreds",
  "exposed credentials": "credexposure",
  "hardcoded credentials": "credexposure",
  "information disclosure": "infodisclosure",
  "information leak": "infodisclosure",
  "ssl": "tlsconfig",
  "tls": "tlsconfig",
  "weak tls": "tlsconfig",
  "weak ssl": "tlsconfig",
  "missing security headers": "headers",
  "clickjacking": "clickjacking",
}

function normaliseTitle(title: string): string {
  const lower = title.toLowerCase()
  for (const [alias, canonical] of Object.entries(VULN_CLASS_ALIASES)) {
    if (lower.includes(alias)) return canonical
  }
  return lower
}

function tokenise(text: string): Map<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)

  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1)
  }
  return freq
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0

  Array.from(a.entries()).forEach(([term, countA]) => {
    normA += countA * countA
    const countB = b.get(term) ?? 0
    dot += countA * countB
  })
  Array.from(b.values()).forEach((countB) => {
    normB += countB * countB
  })

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function findDuplicateCandidates(
  incoming: ParsedFinding[],
  existing: Finding[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = []

  for (const inc of incoming) {
    for (const ext of existing) {
      const matchReasons: string[] = []
      let matchCount = 0

      if (inc.host && ext.host && inc.host === ext.host) {
        matchReasons.push("Same host")
        matchCount++
      }

      if (inc.port != null && ext.port != null && inc.port === ext.port) {
        matchReasons.push("Same port")
        matchCount++
      }

      const incClass = normaliseTitle(inc.title)
      const extClass = normaliseTitle(ext.title)
      if (incClass === extClass) {
        matchReasons.push(
          incClass !== inc.title.toLowerCase()
            ? "Same vulnerability class inferred from name"
            : "Identical title"
        )
        matchCount++
      }

      if (matchCount < 2) continue

      const incTokens = tokenise(inc.title + " " + (inc.description ?? ""))
      const extTokens = tokenise(ext.title + " " + ext.description)
      const similarity = cosineSimilarity(incTokens, extTokens)

      if (similarity >= 0.7) {
        candidates.push({ incoming: inc, existing: ext, similarity, matchReasons })
      }
    }
  }

  return candidates
}
