import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { ObservationFeed } from "@/components/capture/ObservationFeed"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default async function CapturePage({
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

  const observations = await prisma.observation.findMany({
    where: { engagementId: id, status: { not: "archived" } },
    orderBy: { createdAt: "desc" },
  })

  const now = new Date()
  const closingSoon =
    engagement.endDate &&
    engagement.endDate.getTime() - now.getTime() < 48 * 60 * 60 * 1000 &&
    engagement.endDate > now

  const rawCount = observations.filter((o) => o.status === "raw").length
  const hoursLeft = engagement.endDate
    ? Math.floor((engagement.endDate.getTime() - now.getTime()) / (1000 * 60 * 60))
    : null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Capture</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/engagements/${id}`} className="hover:underline">
              {engagement.name}
            </Link>
          </p>
        </div>
      </div>

      {closingSoon && rawCount > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-medium">
              Engagement closes in {hoursLeft}h — {rawCount} observation
              {rawCount !== 1 ? "s" : ""} need triage
            </span>
            <Link
              href={`/engagements/${id}/closing`}
              className="ml-auto text-amber-700 underline underline-offset-4 hover:no-underline whitespace-nowrap"
            >
              Closing view →
            </Link>
          </div>
        </div>
      )}

      <ObservationFeed
        engagementId={id}
        initialObservations={observations.map((o) => ({
          id: o.id,
          content: o.content,
          source: o.source,
          host: o.host,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          engagementId: o.engagementId,
        }))}
      />
    </div>
  )
}
