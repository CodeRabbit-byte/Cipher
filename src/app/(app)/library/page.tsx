import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { LibrarySearch } from "@/components/findings/LibrarySearch"

export default async function LibraryPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const findings = await prisma.finding.findMany({
    where: { engagement: { userId: session.user.id } },
    include: { engagement: { select: { name: true, clientName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Finding Library</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All confirmed findings across engagements
        </p>
      </div>

      <LibrarySearch
        findings={findings.map((f) => ({
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
          engagementName: f.engagement.name,
          clientName: f.engagement.clientName,
        }))}
      />
    </div>
  )
}
