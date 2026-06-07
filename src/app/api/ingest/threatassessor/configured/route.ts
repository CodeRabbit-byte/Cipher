import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.THREATASSESSOR_API_KEY?.trim()
  const baseUrl = (process.env.THREATASSESSOR_URL ?? "http://localhost:8000").replace(/\/$/, "")

  const configured = !!(apiKey && apiKey.length > 0)

  if (!configured) {
    return NextResponse.json({ configured: false, running: false })
  }

  // Key is present — probe the health endpoint to check if TA is actually up
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal })
    clearTimeout(timeout)
    return NextResponse.json({ configured: true, running: res.ok })
  } catch {
    return NextResponse.json({ configured: true, running: false })
  }
}
