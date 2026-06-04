import { auth } from "@/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "File type not allowed" }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 10 MB)" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
  const name = `${randomUUID()}.${ext}`
  const uploadsDir = join(process.cwd(), "public", "uploads")

  await mkdir(uploadsDir, { recursive: true })
  await writeFile(join(uploadsDir, name), Buffer.from(await file.arrayBuffer()))

  return Response.json({ url: `/uploads/${name}` })
}
