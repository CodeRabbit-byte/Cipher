import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { readFile, writeFile, rm } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const CONFIG_PATH = path.join(
  process.cwd(), "vendor", "threatassessor", "chatbot", "config", "user_config.json"
)

const DEFAULTS: Record<string, Record<string, unknown>> = {
  engine: {
    max_paths: 10,
    top_n: 5,
    weight_target: 0.4,
    weight_length: 0.2,
    weight_control: 0.3,
    weight_entry: 0.1,
  },
  confidence: {
    base_confidence_floor: 0.72,
    base_confidence_ceiling: 0.995,
    node_penalty_factor: 0.005,
    edge_penalty_factor: 0.002,
    node_saturation: 30,
    edge_saturation: 50,
  },
  completeness: {
    technique_coverage_threshold: 0.5,
  },
  residual_risk: {
    min_failure_probability: 0.1,
    accept_threshold: 25,
    monitor_threshold: 50,
  },
  moe: {
    enabled: false,
    base_confidence: 99.5,
    critic_mode: "sequential",
    architect_sensitivity: "balanced",
    tester_sensitivity: "balanced",
    red_team_sensitivity: "balanced",
  },
  patterns: {
    enabled_patterns: ["ai_ml_arc", "cloud"],
  },
  purple_team: {
    enabled: true,
    detection_focus: "balanced",
  },
  blackhat: {
    enabled: true,
    rubric_preset: "balanced",
  },
  system: {
    max_file_size_mb: 10,
  },
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let current = { ...DEFAULTS }
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = await readFile(CONFIG_PATH, "utf-8")
      const userConfig = JSON.parse(raw)
      // Deep merge user config over defaults
      for (const [section, vals] of Object.entries(userConfig)) {
        if (typeof vals === "object" && vals !== null) {
          current[section as keyof typeof DEFAULTS] = {
            ...(current[section as keyof typeof DEFAULTS] ?? {}),
            ...(vals as Record<string, unknown>),
          }
        }
      }
    } catch { /* ignore malformed */ }
  }

  return NextResponse.json({ config: current, defaults: DEFAULTS })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  await writeFile(CONFIG_PATH, JSON.stringify(body, null, 2), "utf-8")
  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (existsSync(CONFIG_PATH)) {
    await rm(CONFIG_PATH)
  }
  return NextResponse.json({ success: true, config: DEFAULTS })
}
