import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { parseMetasploitXml } from "@/lib/parsers/metasploit"

// 50 MB hard cap — prevents XML bomb / DoS via unbounded request body
const MAX_BODY_BYTES = 50_000_000

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const contentLength = Number(req.headers.get("content-length") ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 })
  }

  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 })
    }
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 })
    }
    const result = parseMetasploitXml(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 })
  }
}
