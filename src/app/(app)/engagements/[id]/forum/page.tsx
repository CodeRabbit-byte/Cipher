import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { ForumPage } from "@/components/forum/ForumPage"
import { readdir, readFile } from "fs/promises"
import path from "path"

const TA_REPORT_DIR = path.join(process.cwd(), "vendor", "threatassessor", "report")

async function loadTaReports() {
  try {
    const entries = await readdir(TA_REPORT_DIR, { withFileTypes: true })
    const results = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (dir) => {
          try {
            const raw = await readFile(
              path.join(TA_REPORT_DIR, dir.name, "ground_truth.json"),
              "utf-8"
            )
            return { name: dir.name, data: JSON.parse(raw) }
          } catch {
            return null
          }
        })
    )
    return results.filter((r): r is { name: string; data: Record<string, unknown> } => r !== null)
  } catch {
    return []
  }
}

export default async function EngagementForumPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { id } = await params

  const [engagement, taReports] = await Promise.all([
    prisma.engagement.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        name: true,
        forumNotes: true,
        observations: {
          orderBy: { createdAt: "desc" },
          select: { id: true, content: true, status: true, createdAt: true },
        },
        findings: {
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
          select: { id: true, title: true, description: true, severity: true, host: true },
        },
      },
    }),
    loadTaReports(),
  ])

  if (!engagement) notFound()

  return (
    <ForumPage
      engagementId={id}
      engagementName={engagement.name}
      initialNotes={engagement.forumNotes}
      observations={engagement.observations.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      }))}
      findings={engagement.findings}
      taReports={taReports}
    />
  )
}
