import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Crosshair } from "lucide-react"
import { EngagementDeleteButton } from "@/components/engagements/EngagementDeleteButton"

export default async function EngagementsPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const engagements = await prisma.engagement.findMany({
    where: { userId: session.user.id },
    include: {
      findings: { select: { severity: true } },
      _count: { select: { observations: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Engagements</h1>
        <Button asChild>
          <Link href="/engagements/new">
            <Plus className="h-4 w-4 mr-2" />
            New engagement
          </Link>
        </Button>
      </div>

      {engagements.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Crosshair className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No engagements yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {engagements.map((eng) => {
            const critical = eng.findings.filter((f) => f.severity === "critical").length
            const high = eng.findings.filter((f) => f.severity === "high").length
            const medium = eng.findings.filter((f) => f.severity === "medium").length
            return (
              <div key={eng.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/engagements/${eng.id}`}
                      className="font-medium hover:underline truncate"
                    >
                      {eng.name}
                    </Link>
                    <StatusBadge status={eng.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{eng.clientName}</p>
                </div>
                <div className="flex items-center gap-2 text-sm shrink-0">
                  {critical > 0 && (
                    <Badge variant="destructive" className="text-xs">{critical}C</Badge>
                  )}
                  {high > 0 && (
                    <Badge className="text-xs bg-orange-500 hover:bg-orange-600">{high}H</Badge>
                  )}
                  {medium > 0 && (
                    <Badge variant="secondary" className="text-xs">{medium}M</Badge>
                  )}
                  <span className="text-muted-foreground">
                    {eng._count.observations} obs.
                  </span>
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/engagements/${eng.id}/capture`}>Capture</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/engagements/${eng.id}/findings`}>Findings</Link>
                  </Button>
                  <EngagementDeleteButton id={eng.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    active: "bg-green-100 text-green-800 border border-green-200",
    closing: "bg-amber-100 text-amber-800 border border-amber-200",
    complete: "bg-gray-100 text-gray-600 border border-gray-200",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes[status] ?? classes.active}`}>
      {status}
    </span>
  )
}
