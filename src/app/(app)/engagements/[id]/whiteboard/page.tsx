import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { Whiteboard } from "@/components/whiteboard/Whiteboard"

export default async function WhiteboardPage({
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

  return <Whiteboard engagementId={id} engagementName={engagement.name} />
}
