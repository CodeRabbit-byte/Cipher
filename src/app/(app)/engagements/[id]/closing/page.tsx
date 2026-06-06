import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ClosingView } from "@/components/closing/ClosingView"

export default async function ClosingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { id } = await params
  const engagement = await prisma.engagement.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!engagement) notFound()

  const rawObservations = await prisma.observation.findMany({
    where: { engagementId: id, status: "raw" },
    orderBy: { createdAt: "asc" },
  })

  const confirmedFindings = await prisma.finding.findMany({
    where: { engagementId: id },
    select: { id: true, title: true, severity: true },
    orderBy: { createdAt: "desc" },
  })

  // All ThreatAssessor predicted paths (any status) for coverage score
  const taObservations = await prisma.observation.findMany({
    where: { engagementId: id, source: "threatassessor" },
    select: {
      id: true,
      content: true,
      status: true,
      mitreIds: true,
      attackPath: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const now = new Date()
  const hoursLeft = engagement.endDate
    ? Math.floor((engagement.endDate.getTime() - now.getTime()) / (1000 * 60 * 60))
    : null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Closing view</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/engagements/${id}`} className="hover:underline">
            {engagement.name}
          </Link>
          {hoursLeft !== null && hoursLeft > 0 && (
            <span className="ml-2 text-amber-600 font-medium">
              · closes in {hoursLeft}h
            </span>
          )}
        </p>
      </div>

      <ClosingView
        engagementId={id}
        observations={rawObservations.map((o) => ({
          id: o.id,
          content: o.content,
          source: o.source,
          host: o.host,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          engagementId: o.engagementId,
        }))}
        confirmedFindings={confirmedFindings}
        taObservations={taObservations.map((o) => ({
          id: o.id,
          content: o.content,
          status: o.status,
          mitreIds: o.mitreIds,
          attackPath: o.attackPath,
        }))}
      />
    </div>
  )
}
