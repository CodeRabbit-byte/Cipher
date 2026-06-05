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

  try {
    await prisma.$transaction(async (tx) => {
      // Null out observation→finding links so findings can be deleted
      await tx.observation.updateMany({
        where: { engagementId: id },
        data: { findingId: null },
      })
      // Delete observations
      await tx.observation.deleteMany({ where: { engagementId: id } })
      // Clear the self-referencing finding chain join table
      await tx.$executeRaw`DELETE FROM "_FindingChain" WHERE A IN (SELECT id FROM "Finding" WHERE "engagementId" = ${id}) OR B IN (SELECT id FROM "Finding" WHERE "engagementId" = ${id})`
      // Delete findings
      await tx.finding.deleteMany({ where: { engagementId: id } })
      // Now safe to delete the engagement
      await tx.engagement.delete({ where: { id } })
    })
  } catch {
    return NextResponse.json({ error: "Failed to delete engagement" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
