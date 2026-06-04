import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextRequest } from "next/server"
import { z } from "zod"

const bodySchema = z.object({
  content: z.string().max(500_000),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const engagement = await prisma.engagement.findFirst({
    where: { id, userId: session.user.id },
    select: { forumNotes: true },
  })
  if (!engagement) return Response.json({ error: "Not found" }, { status: 404 })

  return Response.json({ content: engagement.forumNotes })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 })

  const engagement = await prisma.engagement.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  })
  if (!engagement) return Response.json({ error: "Not found" }, { status: 404 })

  await prisma.engagement.update({
    where: { id },
    data: { forumNotes: parsed.data.content },
  })

  return Response.json({ ok: true })
}
