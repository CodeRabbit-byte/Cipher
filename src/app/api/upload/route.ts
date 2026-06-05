import { auth } from "@/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"

// SVG is active content and is NOT permitted — it enables stored XSS.
// Extensions are derived from this server-side map, never from the client filename.
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
}

// ---------------------------------------------------------------------------
// In-memory per-user rate limiter for the upload endpoint
// Allows at most UPLOAD_MAX_REQUESTS per UPLOAD_WINDOW_MS per user.
// ---------------------------------------------------------------------------
const UPLOAD_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const UPLOAD_MAX_REQUESTS = 20

const uploadRequests = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = uploadRequests.get(userId)
  if (!entry || now - entry.windowStart > UPLOAD_WINDOW_MS) {
    uploadRequests.set(userId, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  if (entry.count > UPLOAD_MAX_REQUESTS) return true
  return false
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  if (isRateLimited(session.user.id)) {
    return Response.json({ error: "Too many uploads. Please try again later." }, { status: 429 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return Response.json({ error: "No file provided" }, { status: 400 })

  // Validate MIME type against server-side allowlist (client-supplied type, but we
  // only accept the four safe raster image types above — no SVG/HTML/text).
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return Response.json({ error: "File type not allowed" }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 10 MB)" }, { status: 400 })
  }

  // Store uploads OUTSIDE public/ so they are not directly accessible by URL.
  // Access is gated through GET /api/uploads/[filename] which enforces auth.
  const uuid = randomUUID()
  const name = `${uuid}.${ext}`
  const uploadsDir = join(process.cwd(), "upload_store")

  await mkdir(uploadsDir, { recursive: true })
  await writeFile(join(uploadsDir, name), Buffer.from(await file.arrayBuffer()))

  // Return an API route URL, not a static /uploads/ URL.
  return Response.json({ url: `/api/uploads/${name}` })
}
