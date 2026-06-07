import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

const TA_URL = process.env.THREATASSESSOR_URL
const TA_KEY = process.env.THREATASSESSOR_API_KEY ?? ""

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!TA_URL) {
    return NextResponse.json(
      { configured: false, serverDown: false, error: "THREATASSESSOR_URL is not set." },
      { status: 503 }
    )
  }

  const { searchParams } = req.nextUrl
  const archName = searchParams.get("architecture_name")
  if (!archName) {
    return NextResponse.json({ error: "architecture_name is required" }, { status: 400 })
  }

  const criticMode = searchParams.get("critic_mode") ?? "sequential"
  const runBlackhat = searchParams.get("run_blackhat") ?? "true"

  const upstream = new URL(`${TA_URL}/api/v1/expert-review`)
  upstream.searchParams.set("architecture_name", archName)
  upstream.searchParams.set("critic_mode", criticMode)
  upstream.searchParams.set("run_blackhat", runBlackhat)

  try {
    const taRes = await fetch(upstream.toString(), {
      headers: { "TM-API-KEY": TA_KEY },
    })

    if (!taRes.ok) {
      const text = await taRes.text()
      return NextResponse.json(
        { error: `ThreatAssessor API error ${taRes.status}: ${text.slice(0, 400)}` },
        { status: taRes.status }
      )
    }

    // Pipe the SSE stream through
    const contentType = taRes.headers.get("content-type") ?? "text/event-stream"
    return new NextResponse(taRes.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { configured: true, serverDown: true, error: `ThreatAssessor API at ${TA_URL} is unreachable. Start the server first.` },
      { status: 502 }
    )
  }
}
