import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const configured = !!(
    process.env.THREATASSESSOR_API_KEY &&
    process.env.THREATASSESSOR_API_KEY.trim().length > 0
  )

  return NextResponse.json({ configured })
}
