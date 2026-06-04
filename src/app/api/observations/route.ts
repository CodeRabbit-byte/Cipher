import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createSchema = z.object({
  content: z.string().min(1).max(10000),
  engagementId: z.string().cuid(),
  host: z.string().max(500).optional().nullable(),
  source: z.enum(["manual", "burp", "nmap", "nuclei", "nessus"]).default("manual"),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }

  const engagement = await prisma.engagement.findFirst({
    where: { id: parsed.data.engagementId, userId: session.user.id },
  })
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 })

  const observation = await prisma.observation.create({ data: parsed.data })
  return NextResponse.json(observation, { status: 201 })
}
