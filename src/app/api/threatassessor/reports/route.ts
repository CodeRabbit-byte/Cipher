import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { readdir, readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const REPORT_DIR = path.join(process.cwd(), "vendor", "threatassessor", "report")

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!existsSync(REPORT_DIR)) return NextResponse.json({ reports: [] })

  const entries = await readdir(REPORT_DIR, { withFileTypes: true })
  const reports = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const gtPath = path.join(REPORT_DIR, entry.name, "ground_truth.json")
    if (!existsSync(gtPath)) continue
    try {
      const d = JSON.parse(await readFile(gtPath, "utf8"))
      reports.push({
        name: entry.name,
        riskScore: d.expected_risk_score ?? 0,
        defensibility: d.expected_defensibility ?? 0,
        architectureType: d.metadata?.architecture_type ?? "unknown",
        nodeCount: d.metadata?.node_count ?? 0,
        attackPathCount: (d.expected_attack_paths ?? []).length,
        controlCoverage: d.metadata?.control_coverage ?? 0,
      })
    } catch { /* skip malformed */ }
  }

  return NextResponse.json({ reports })
}
