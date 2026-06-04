import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Crosshair, AlertTriangle, Plus } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const engagements = await prisma.engagement.findMany({
    where: { userId: session.user.id, status: { not: "complete" } },
    include: {
      findings: { select: { severity: true } },
      observations: { where: { status: "raw" }, select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  })

  const now = new Date()
  const closingSoon = engagements.filter(
    (e) =>
      e.endDate &&
      e.endDate.getTime() - now.getTime() < 48 * 60 * 60 * 1000 &&
      e.endDate > now
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back, {session.user.name ?? session.user.email}
          </p>
        </div>
        <Button asChild>
          <Link href="/engagements/new">
            <Plus className="h-4 w-4 mr-2" />
            New engagement
          </Link>
        </Button>
      </div>

      {closingSoon.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-medium text-sm">
              {closingSoon.length} engagement{closingSoon.length > 1 ? "s" : ""} closing within 48 hours
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {closingSoon.map((e) => {
              const hoursLeft = Math.floor(
                (e.endDate!.getTime() - now.getTime()) / (1000 * 60 * 60)
              )
              const rawCount = e.observations.length
              return (
                <li key={e.id} className="text-sm text-amber-700">
                  <Link href={`/engagements/${e.id}/closing`} className="underline hover:no-underline">
                    {e.name}
                  </Link>
                  {" "}— closes in {hoursLeft}h
                  {rawCount > 0 && `, ${rawCount} observation${rawCount > 1 ? "s" : ""} untriaged`}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {engagements.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Crosshair className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active engagements</p>
          <p className="text-sm mt-1">Create one to get started</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/engagements/new">Create engagement</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {engagements.map((eng) => {
            const critical = eng.findings.filter((f) => f.severity === "critical").length
            const high = eng.findings.filter((f) => f.severity === "high").length
            return (
              <Card key={eng.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">
                      <Link
                        href={`/engagements/${eng.id}`}
                        className="hover:underline"
                      >
                        {eng.name}
                      </Link>
                    </CardTitle>
                    <StatusBadge status={eng.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{eng.clientName}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-sm">
                    {critical > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                        {critical} critical
                      </span>
                    )}
                    {high > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                        {high} high
                      </span>
                    )}
                    {eng.observations.length > 0 && (
                      <span className="text-muted-foreground">
                        {eng.observations.length} raw obs.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    closing: "bg-amber-100 text-amber-800 border-amber-200",
    complete: "bg-gray-100 text-gray-600 border-gray-200",
  }
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${variants[status] ?? variants.active}`}
    >
      {status}
    </span>
  )
}
