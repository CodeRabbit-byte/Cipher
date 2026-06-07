import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const REPORT_DIR = path.join(process.cwd(), "vendor", "threatassessor", "report")

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await params
  const safe = path.basename(name)
  const gtPath = path.join(REPORT_DIR, safe, "ground_truth.json")

  if (!existsSync(gtPath)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 })
  }

  const data = JSON.parse(await readFile(gtPath, "utf8"))
  return NextResponse.json({ data, architectureName: safe })
}
