import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { FindingsList } from "@/components/findings/FindingsList"

export default async function FindingsPage({
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

  const findings = await prisma.finding.findMany({
    where: { engagementId: id },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Findings</h1>
        <p className="text-sm text-muted-foreground">
          <Link href={`/engagements/${id}`} className="hover:underline">
            {engagement.name}
          </Link>
        </p>
      </div>

      <FindingsList
        engagementId={id}
        initialFindings={findings.map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
          severity: f.severity,
          host: f.host,
          port: f.port,
          cvss: f.cvss,
          cveIds: f.cveIds,
          remediationNote: f.remediationNote,
          evidence: f.evidence,
          source: f.source,
          engagementId: f.engagementId,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        }))}
      />
    </div>
  )
}
