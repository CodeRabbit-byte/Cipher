import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { ForumPage } from "@/components/forum/ForumPage"

export default async function EngagementForumPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { id } = await params

  const engagement = await prisma.engagement.findFirst({
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
  })

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
    />
  )
}
