import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateSchema = z.object({
  status: z.enum(["raw", "promoted", "archived"]).optional(),
  findingId: z.string().cuid().optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const obs = await prisma.observation.findUnique({
    where: { id },
    include: { engagement: { select: { userId: true } } },
  })
  if (!obs || obs.engagement.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const updated = await prisma.observation.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const obs = await prisma.observation.findUnique({
    where: { id },
    include: { engagement: { select: { userId: true } } },
  })
  if (!obs || obs.engagement.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.observation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
