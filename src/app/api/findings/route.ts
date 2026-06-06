import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(50000),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  engagementId: z.string().cuid(),
  cvss: z.number().min(0).max(10).optional().nullable(),
  host: z.string().max(500).optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  evidence: z.string().max(5000).optional().nullable(),
  remediationNote: z.string().max(5000).optional().nullable(),
  cveIds: z.string().max(1000).optional().nullable(),
  source: z
    .enum(["manual", "burp", "nmap", "nuclei", "nessus", "metasploit", "threatassessor"])
    .default("manual"),
  observationIds: z.array(z.string().cuid()).optional(),
  mitreIds: z.string().max(2000).optional().nullable(),
  mitreMitigations: z.string().max(2000).optional().nullable(),
  sspControls: z.string().max(2000).optional().nullable(),
  taConfidence: z.number().min(0).max(1).optional().nullable(),
  attackPath: z.string().max(1000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const engagementId = url.searchParams.get("engagementId")

  if (engagementId) {
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, userId: session.user.id },
    })
    if (!engagement) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const SEVERITY_RANK: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    }
    const findings = await prisma.finding.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    })
    findings.sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 5) - (SEVERITY_RANK[b.severity] ?? 5)
    )
    return NextResponse.json(findings)
  }

  // Global library — all findings across user's engagements
  const findings = await prisma.finding.findMany({
    where: { engagement: { userId: session.user.id } },
    include: { engagement: { select: { name: true, clientName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return NextResponse.json(findings)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })
  }

  const { observationIds, ...findingData } = parsed.data

  const engagement = await prisma.engagement.findFirst({
    where: { id: findingData.engagementId, userId: session.user.id },
  })
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 })

  // IDOR guard: verify every supplied observationId belongs to the authenticated
  // user's engagement before linking.
  if (observationIds?.length) {
    const ownedCount = await prisma.observation.count({
      where: {
        id: { in: observationIds },
        engagementId: findingData.engagementId,
        engagement: { userId: session.user.id },
      },
    })
    if (ownedCount !== observationIds.length) {
      return NextResponse.json({ error: "Invalid observation IDs" }, { status: 403 })
    }
  }

  // When promoting ThreatAssessor observations, inherit TA fields from the
  // observation if they were not explicitly provided in the request body.
  let taFieldOverrides: {
    mitreIds?: string | null
    mitreMitigations?: string | null
    sspControls?: string | null
    taConfidence?: number | null
    attackPath?: string | null
  } = {}

  if (observationIds?.length && !findingData.mitreIds) {
    const taObs = await prisma.observation.findFirst({
      where: {
        id: { in: observationIds },
        source: "threatassessor",
      },
      select: {
        mitreIds: true,
        mitreMitigations: true,
        sspControls: true,
        taConfidence: true,
        attackPath: true,
      },
    })
    if (taObs) {
      taFieldOverrides = {
        mitreIds: taObs.mitreIds,
        mitreMitigations: taObs.mitreMitigations,
        sspControls: taObs.sspControls,
        taConfidence: taObs.taConfidence,
        attackPath: taObs.attackPath,
      }
    }
  }

  const finding = await prisma.finding.create({
    data: {
      ...findingData,
      ...taFieldOverrides,
      ...(observationIds?.length
        ? {
            observations: {
              connect: observationIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
  })

  if (observationIds?.length) {
    await prisma.observation.updateMany({
      where: { id: { in: observationIds }, engagementId: findingData.engagementId },
      data: { status: "promoted", findingId: finding.id },
    })
  }

  return NextResponse.json(finding, { status: 201 })
}
