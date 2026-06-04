import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { parseNucleiJson } from "@/lib/parsers/nuclei"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const text = await req.text()
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 })
    }
    const result = parseNucleiJson(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 })
  }
}
