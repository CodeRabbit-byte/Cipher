import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { spawn } from "child_process"
import { existsSync } from "fs"
import path from "path"

const TA_DIR = path.join(process.cwd(), "vendor", "threatassessor")
const VENV_PYTHON = process.platform === "win32"
  ? path.join(TA_DIR, ".venv", "Scripts", "python.exe")
  : path.join(TA_DIR, ".venv", "bin", "python3")
const LOOKUP_SCRIPT = path.join(process.cwd(), "scripts", "ta_mitre_lookup.py")

// Also try proxying to TA API if configured
const TA_URL = process.env.THREATASSESSOR_URL
const TA_KEY = process.env.THREATASSESSOR_API_KEY ?? ""

function runLookup(mode: string, query: string): Promise<{ results: unknown[]; error?: string }> {
  return new Promise((resolve) => {
    if (!existsSync(VENV_PYTHON)) {
      resolve({ results: [], error: "ThreatAssessor venv not set up. Run npm run dev:full first." })
      return
    }
    const proc = spawn(VENV_PYTHON, [LOOKUP_SCRIPT, mode, query], {
      cwd: TA_DIR,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONPATH: TA_DIR },
    })
    let stdout = ""
    let stderr = ""
    proc.stdout?.on("data", (d) => { stdout += d.toString() })
    proc.stderr?.on("data", (d) => { stderr += d.toString() })
    proc.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim())
        resolve(parsed)
      } catch {
        resolve({ results: [], error: stderr.slice(0, 400) || "No output from lookup script." })
      }
    })
  })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const mode = searchParams.get("mode") ?? "techniques"   // techniques | mitigations | technique-mitigations
  const q = searchParams.get("q") ?? ""

  if (!q || q.length < 2) {
    return NextResponse.json({ error: "q must be at least 2 characters", results: [] }, { status: 400 })
  }

  const ALLOWED_MODES = ["techniques", "mitigations", "technique-mitigations"]
  if (!ALLOWED_MODES.includes(mode)) {
    return NextResponse.json({ error: `mode must be one of: ${ALLOWED_MODES.join(", ")}`, results: [] }, { status: 400 })
  }

  // Try TA API first if configured (faster, no subprocess overhead)
  if (TA_URL) {
    try {
      const upstream = new URL(`${TA_URL}/api/v1/${mode}`)
      const paramKey = mode === "technique-mitigations" ? "technique_ids" : `${mode.replace("s", "")}_ids`
      if (q.match(/^[TM]\d/i)) {
        upstream.searchParams.set(paramKey, q.toUpperCase())
      } else {
        // TA API doesn't support keyword search on these endpoints — fall through to subprocess
        throw new Error("keyword search not supported by TA API endpoints")
      }
      const res = await fetch(upstream.toString(), { headers: { "TM-API-KEY": TA_KEY } })
      if (res.ok) {
        const data = await res.json()
        const results = Object.entries(data as Record<string, unknown>).map(([id, name]) => ({ id, name }))
        return NextResponse.json({ results, source: "api" })
      }
    } catch { /* fall through to subprocess */ }
  }

  // Fall back to subprocess lookup
  const result = await runLookup(mode, q)
  return NextResponse.json({ ...result, source: "subprocess" })
}
