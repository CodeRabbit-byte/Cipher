import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { readdir, readFile, stat } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const REPORT_DIR = path.join(process.cwd(), "vendor", "threatassessor", "report")

const REPORT_META: Record<string, { label: string; type: "markdown" | "json" | "mermaid" }> = {
  "ground_truth.json":          { label: "Ground Truth",       type: "json" },
  "01_executive_summary.md":    { label: "Executive Summary",  type: "markdown" },
  "02_technical_report.md":     { label: "Technical Report",   type: "markdown" },
  "03_action_plan.md":          { label: "Action Plan",        type: "markdown" },
  "04_architect_critique.json": { label: "Architect Critique", type: "json" },
  "05_tester_critique.json":    { label: "Tester Critique",    type: "json" },
  "06_red_team_critique.json":  { label: "Red Team Critique",  type: "json" },
  "07_purple_team_critique.json": { label: "Purple Team",      type: "json" },
  "08_blackhat_critique.json":  { label: "Blackhat Critique",  type: "json" },
  "09_threat_model.md":         { label: "Threat Model",       type: "markdown" },
  "10_adr_report.md":           { label: "ADR Report",         type: "markdown" },
  "before.mmd":                 { label: "Before Diagram",     type: "mermaid" },
  "after.mmd":                  { label: "After Diagram",      type: "mermaid" },
  "moe_orchestrator.json":      { label: "MoE Orchestrator",   type: "json" },
}

// GET /api/threatassessor/reports/[name]/files
// → list all present files with metadata
//
// GET /api/threatassessor/reports/[name]/files?f=filename
// → return content of a single file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await params
  const safe = path.basename(name)
  const archDir = path.join(REPORT_DIR, safe)

  if (!existsSync(archDir)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 })
  }

  const fParam = req.nextUrl.searchParams.get("f")

  // Single file content
  if (fParam) {
    const safeFname = path.basename(fParam)
    const filePath = path.join(archDir, safeFname)
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }
    const content = await readFile(filePath, "utf-8")
    const meta = REPORT_META[safeFname]
    return NextResponse.json({
      filename: safeFname,
      content,
      type: meta?.type ?? (safeFname.endsWith(".json") ? "json" : safeFname.endsWith(".mmd") ? "mermaid" : "markdown"),
      label: meta?.label ?? safeFname,
    })
  }

  // List all files
  const entries = await readdir(archDir, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter(e => e.isFile() && e.name !== "README.md")
      .map(async (e) => {
        const filePath = path.join(archDir, e.name)
        const stats = await stat(filePath)
        const meta = REPORT_META[e.name]
        return {
          filename: e.name,
          label: meta?.label ?? e.name,
          type: meta?.type ?? (e.name.endsWith(".json") ? "json" : e.name.endsWith(".mmd") ? "mermaid" : "markdown"),
          sizeBytes: stats.size,
          order: Object.keys(REPORT_META).indexOf(e.name),
        }
      })
  )

  files.sort((a, b) => (a.order === -1 ? 999 : a.order) - (b.order === -1 ? 999 : b.order))

  return NextResponse.json({ files, architectureName: safe })
}
