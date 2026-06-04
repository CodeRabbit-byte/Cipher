import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().min(1).max(200),
  clientBrief: z.string().max(2000).optional(),
  scope: z.string().max(2000).optional(),
  endDate: z.string().datetime({ offset: true }).optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const engagements = await prisma.engagement.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json(engagements)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, clientName, clientBrief, scope, endDate } = parsed.data

  const engagement = await prisma.engagement.create({
    data: {
      name,
      clientName,
      clientBrief: clientBrief ?? null,
      scope: scope ?? null,
      endDate: endDate ? new Date(endDate) : null,
      userId: session.user.id,
    },
  })

  return NextResponse.json(engagement, { status: 201 })
}
