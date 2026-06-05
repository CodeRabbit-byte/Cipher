import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { readFile } from "fs/promises"
import { join } from "path"

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { filename } = await params

  // Only allow uuid.ext pattern — no path traversal
  if (!/^[0-9a-f-]+\.[a-z0-9]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
  }

  const ext = filename.split(".").pop() ?? ""
  const mimeType = EXT_TO_MIME[ext]
  if (!mimeType) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
  }

  const filePath = join(process.cwd(), "upload_store", filename)

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
