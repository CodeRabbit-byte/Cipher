import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { searchCves } from "@/lib/cve"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 3) {
    return NextResponse.json({ error: "Query must be at least 3 characters" }, { status: 400 })
  }

  try {
    const cves = await searchCves(q, { limit: 15 })
    return NextResponse.json({ cves, total: cves.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    console.error("[api/cve]", msg)
    // Surface rate-limit errors distinctly
    if (msg.includes("403") || msg.includes("429")) {
      return NextResponse.json(
        { error: "NVD rate limit reached — add NVD_API_KEY to .env for higher limits" },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "CVE lookup failed" }, { status: 502 })
  }
}
