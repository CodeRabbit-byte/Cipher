import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { AgentChat } from "@/components/agent/AgentChat"

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { id } = await params
  const engagement = await prisma.engagement.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, name: true },
  })

  if (!engagement) notFound()

  return <AgentChat engagementId={engagement.id} engagementName={engagement.name} />
}
