import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

async function getEngagement(id: string, userId: string) {
  return prisma.engagement.findFirst({ where: { id, userId } })
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientName: z.string().min(1).max(200).optional(),
  clientBrief: z.string().max(2000).optional().nullable(),
  scope: z.string().max(2000).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).optional().nullable(),
  status: z.enum(["active", "closing", "complete"]).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const engagement = await getEngagement(id, session.user.id)
  if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(engagement)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await getEngagement(id, session.user.id)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const updated = await prisma.engagement.update({
    where: { id },
    data: {
      ...parsed.data,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : parsed.data.endDate,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await getEngagement(id, session.user.id)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.engagement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
