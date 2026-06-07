import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { spawn } from "child_process"
import { writeFile, readFile, rm, mkdtemp } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import os from "os"

const TA_DIR = path.join(process.cwd(), "vendor", "threatassessor")
const VENV_PYTHON = process.platform === "win32"
  ? path.join(TA_DIR, ".venv", "Scripts", "python.exe")
  : path.join(TA_DIR, ".venv", "bin", "python3")

const HELPER_SCRIPT = path.join(process.cwd(), "scripts", "ta_analyze.py")

function runPython(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(VENV_PYTHON, args, {
      cwd: TA_DIR,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONPATH: TA_DIR },
    })
    let stdout = ""
    let stderr = ""
    proc.stdout?.on("data", (d) => { stdout += d.toString() })
    proc.stderr?.on("data", (d) => { stderr += d.toString() })
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!existsSync(VENV_PYTHON)) {
    return NextResponse.json(
      { error: "ThreatAssessor is not set up. Run: npm run dev:full (first time only)." },
      { status: 503 }
    )
  }

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }) }

  const file = form.get("architecture_file")
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No architecture_file provided." }, { status: 400 })
  }
  if (!file.name.endsWith(".mmd")) {
    return NextResponse.json({ error: "File must be a .mmd Mermaid diagram." }, { status: 400 })
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "cipher-ta-"))
  const tmpFile = path.join(tmpDir, file.name)

  try {
    await writeFile(tmpFile, Buffer.from(await file.arrayBuffer()))

    const sspProfile = (form.get("ssp_profile") as string | null) ?? "medium_risk_cloud"
    const { code, stdout, stderr } = await runPython([HELPER_SCRIPT, tmpFile, sspProfile])

    if (code !== 0) {
      return NextResponse.json(
        { error: `Analysis failed: ${stderr.slice(-800) || "Unknown error"}` },
        { status: 500 }
      )
    }

    // The helper script prints the ground_truth JSON to stdout
    let data: unknown
    try {
      data = JSON.parse(stdout.trim())
    } catch {
      return NextResponse.json(
        { error: "Analysis completed but output could not be parsed." },
        { status: 500 }
      )
    }

    const archName = file.name.replace(/\.mmd$/, "")
    return NextResponse.json({ success: true, data, architectureName: archName })
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
