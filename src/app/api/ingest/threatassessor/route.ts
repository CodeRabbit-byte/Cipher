import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  parseThreatAssessorGroundTruth,
  parseThreatAssessorResponseData,
  SSP_PROFILES,
} from "@/lib/parsers/threatassessor"
import type { SspProfile } from "@/types"

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB — ThreatAssessor's own limit

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Config check — fail fast with a clear message ─────────────────────────
  const apiKey = process.env.THREATASSESSOR_API_KEY
  const baseUrl = (process.env.THREATASSESSOR_URL ?? "http://localhost:8000").replace(/\/$/, "")

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ThreatAssessor is not configured. Add THREATASSESSOR_URL and " +
          "THREATASSESSOR_API_KEY to your .env file.",
      },
      { status: 503 }
    )
  }

  // ── Parse form data ────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 })
  }

  const file = formData.get("architecture_file")
  const rawProfile = (formData.get("ssp_profile") as string | null) ?? "medium_risk_cloud"
  const mode = (formData.get("mode") as string | null) ?? "fast"
  const engagementId = formData.get("engagement_id") as string | null

  // ── Input validation ───────────────────────────────────────────────────────
  if (!SSP_PROFILES.includes(rawProfile as SspProfile)) {
    return NextResponse.json(
      { error: `Invalid ssp_profile. Must be one of: ${SSP_PROFILES.join(", ")}` },
      { status: 400 }
    )
  }

  if (mode !== "fast" && mode !== "full") {
    return NextResponse.json(
      { error: 'Invalid mode. Must be "fast" or "full".' },
      { status: 400 }
    )
  }

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No architecture_file provided." }, { status: 400 })
  }

  if (!file.name.endsWith(".mmd")) {
    return NextResponse.json(
      { error: "File must have .mmd extension (Mermaid diagram format)." },
      { status: 400 }
    )
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 400 }
    )
  }

  const sspProfile = rawProfile as SspProfile
  // Architecture name = filename stem, sanitised for use in TA report paths
  const architectureName = file.name
    .replace(/\.mmd$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")

  // ── Build upstream form ────────────────────────────────────────────────────
  const upstream = new FormData()
  upstream.append("architecture_file", file, file.name)
  // Include ssp_profile; if ThreatAssessor returns 422 for it, remove this line
  upstream.append("ssp_profile", sspProfile)

  // ── Call ThreatAssessor /api/v1/analyze ───────────────────────────────────
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 125_000)

  let taResponse: Response
  try {
    taResponse = await fetch(`${baseUrl}/api/v1/analyze`, {
      method: "POST",
      headers: { "TM-API-KEY": apiKey },
      body: upstream,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        {
          error:
            "ThreatAssessor analysis timed out after 2 minutes. " +
            `Try fast mode, or check ThreatAssessor is healthy: curl ${baseUrl}/health`,
        },
        { status: 504 }
      )
    }
    return NextResponse.json(
      {
        error:
          `Cannot reach ThreatAssessor at ${baseUrl}. ` +
          "Make sure it is running and check THREATASSESSOR_URL.",
      },
      { status: 503 }
    )
  } finally {
    clearTimeout(timeout)
  }

  // ── Handle ThreatAssessor error responses ──────────────────────────────────
  if (!taResponse.ok) {
    let detail = `ThreatAssessor returned HTTP ${taResponse.status}`
    try {
      const body = await taResponse.json()
      if (body?.detail) detail = body.detail
      else if (body?.title) detail = body.title
    } catch { /* non-JSON body */ }

    if (taResponse.status === 401) {
      return NextResponse.json(
        { error: "ThreatAssessor rejected the API key. Check THREATASSESSOR_API_KEY." },
        { status: 502 }
      )
    }
    if (taResponse.status === 422) {
      return NextResponse.json(
        { error: `Invalid Mermaid diagram: ${detail}` },
        { status: 400 }
      )
    }
    if (taResponse.status === 429) {
      return NextResponse.json(
        {
          error:
            "ThreatAssessor rate limit reached (10 req/min). " +
            "Wait a moment and try again.",
        },
        { status: 429 }
      )
    }
    if (taResponse.status === 500) {
      return NextResponse.json(
        { error: "ThreatAssessor returned an internal error. Check its logs." },
        { status: 502 }
      )
    }
    return NextResponse.json({ error: detail }, { status: 502 })
  }

  // ── Parse AnalyzeResponse ──────────────────────────────────────────────────
  let analyzeData: Record<string, unknown>
  try {
    analyzeData = await taResponse.json()
  } catch {
    return NextResponse.json(
      { error: "ThreatAssessor returned an unparseable response." },
      { status: 502 }
    )
  }

  if (!analyzeData.success) {
    return NextResponse.json(
      { error: "ThreatAssessor analysis failed. Check ThreatAssessor logs." },
      { status: 502 }
    )
  }

  // ── Fetch ground_truth.json — the structured data source ───────────────────
  let groundTruth: Record<string, unknown> = {}
  let groundTruthWarning: string | null = null
  try {
    const gtResponse = await fetch(
      `${baseUrl}/api/v1/reports/${architectureName}/files/ground_truth.json`,
      { headers: { "TM-API-KEY": apiKey } }
    )
    if (gtResponse.ok) {
      groundTruth = await gtResponse.json()
    } else {
      groundTruthWarning =
        `Could not fetch ground_truth.json (HTTP ${gtResponse.status}). ` +
        "Falling back to AnalyzeResponse.data."
    }
  } catch {
    groundTruthWarning =
      "Could not fetch ground_truth.json (network error). Falling back to AnalyzeResponse.data."
  }

  // Choose the best available data source
  const useGroundTruth = Object.keys(groundTruth).length > 0
  const sourceData = useGroundTruth
    ? groundTruth
    : ((analyzeData.data as Record<string, unknown>) ?? {})

  // ── Parse findings ─────────────────────────────────────────────────────────
  const { findings, parseWarnings } = useGroundTruth
    ? parseThreatAssessorGroundTruth(sourceData, sspProfile)
    : parseThreatAssessorResponseData(sourceData, sspProfile)

  if (groundTruthWarning) parseWarnings.unshift(groundTruthWarning)

  // ── Update engagement metadata ─────────────────────────────────────────────
  if (engagementId) {
    try {
      const { prisma } = await import("@/lib/db")
      await prisma.engagement.update({
        where: { id: engagementId, userId: session.user.id },
        data: { sspProfile, architectureName, threatModelRunAt: new Date() },
      })
    } catch {
      parseWarnings.push(
        "Could not update engagement with ThreatAssessor metadata (SSP profile, architecture name)."
      )
    }
  }

  // ── Return in the standard ingest shape ────────────────────────────────────
  return NextResponse.json({ findings, parseWarnings })
}
