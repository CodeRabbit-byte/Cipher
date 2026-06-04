import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]).optional(),
  cvss: z.number().min(0).max(10).optional().nullable(),
  host: z.string().max(500).optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  evidence: z.string().max(5000).optional().nullable(),
  remediationNote: z.string().max(5000).optional().nullable(),
  cveIds: z.string().max(1000).optional().nullable(),
  chainedWithIds: z.array(z.string().cuid()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const finding = await prisma.finding.findFirst({
    where: { id, engagement: { userId: session.user.id } },
  })
  if (!finding) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const { chainedWithIds, ...updateData } = parsed.data

  if (chainedWithIds !== undefined && chainedWithIds.length > 0) {
    const count = await prisma.finding.count({
      where: { id: { in: chainedWithIds }, engagement: { userId: session.user.id } },
    })
    if (count !== chainedWithIds.length) {
      return NextResponse.json({ error: "Invalid chainedWithIds" }, { status: 400 })
    }
  }

  const updated = await prisma.finding.update({
    where: { id },
    data: {
      ...updateData,
      ...(chainedWithIds !== undefined
        ? { chainedWith: { set: chainedWithIds.map((cid) => ({ id: cid })) } }
        : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const finding = await prisma.finding.findFirst({
    where: { id, engagement: { userId: session.user.id } },
  })
  if (!finding) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.finding.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
