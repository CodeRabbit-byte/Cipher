import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { PenLine, Crosshair } from "lucide-react"

export default async function WhiteboardIndexPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const engagements = await prisma.engagement.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, clientName: true, status: true },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <PenLine className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Whiteboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pick an engagement to open its planning board
          </p>
        </div>
      </div>

      {engagements.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Crosshair className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No engagements yet.</p>
          <Link href="/engagements/new" className="text-sm text-primary hover:underline mt-1 inline-block">
            Create one to get started
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {engagements.map((eng) => (
            <Link
              key={eng.id}
              href={`/engagements/${eng.id}/whiteboard`}
              className="group flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/30 hover:shadow-sm transition-all"
            >
              <span className="mt-0.5 rounded-md bg-muted p-2 group-hover:bg-primary/10 transition-colors">
                <PenLine className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{eng.name}</span>
                  <StatusBadge status={eng.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{eng.clientName}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    closing: "bg-amber-100 text-amber-800",
    complete: "bg-gray-100 text-gray-500",
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${classes[status] ?? classes.active}`}>
      {status}
    </span>
  )
}
