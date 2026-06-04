import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { IngestPage } from "@/components/ingest/IngestPage"

export default async function IngestRoute({
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

  const existingFindings = await prisma.finding.findMany({
    where: { engagementId: id },
    select: {
      id: true,
      title: true,
      description: true,
      severity: true,
      host: true,
      port: true,
    },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Ingest</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/engagements/${id}`} className="hover:underline">
            {engagement.name}
          </Link>
        </p>
      </div>

      <IngestPage engagementId={id} existingFindings={existingFindings} />
    </div>
  )
}
