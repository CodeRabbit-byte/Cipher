import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquarePlus, FileSearch, Upload, FileText, BookOpen, AlertTriangle, PenLine, Bot } from "lucide-react"

export default async function EngagementOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) return null

  const { id } = await params
  const engagement = await prisma.engagement.findFirst({
    where: { id, userId: session.user.id },
    include: {
      _count: { select: { findings: true, observations: true } },
      findings: { select: { severity: true } },
      observations: { where: { status: "raw" }, select: { id: true } },
    },
  })

  if (!engagement) notFound()

  const now = new Date()
  const closingSoon =
    engagement.endDate &&
    engagement.endDate.getTime() - now.getTime() < 48 * 60 * 60 * 1000 &&
    engagement.endDate > now

  const severityCounts = {
    critical: engagement.findings.filter((f) => f.severity === "critical").length,
    high: engagement.findings.filter((f) => f.severity === "high").length,
    medium: engagement.findings.filter((f) => f.severity === "medium").length,
    low: engagement.findings.filter((f) => f.severity === "low").length,
    info: engagement.findings.filter((f) => f.severity === "info").length,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{engagement.name}</h1>
            <p className="text-muted-foreground mt-1">{engagement.clientName}</p>
          </div>
          <StatusBadge status={engagement.status} />
        </div>
        {engagement.clientBrief && (
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">{engagement.clientBrief}</p>
        )}
        {engagement.endDate && (
          <p className="text-sm text-muted-foreground mt-1">
            End date: {engagement.endDate.toLocaleDateString()}
          </p>
        )}
      </div>

      {closingSoon && engagement.observations.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium text-sm">
              Engagement closes soon — {engagement.observations.length} observation
              {engagement.observations.length !== 1 ? "s" : ""} need triage
            </span>
          </div>
          <Button asChild size="sm" variant="outline" className="mt-2">
            <Link href={`/engagements/${id}/closing`}>Go to closing view</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-6">
        <NavCard
          href={`/engagements/${id}/capture`}
          icon={<MessageSquarePlus className="h-5 w-5" />}
          title="Capture"
          description={`${engagement._count.observations} observations`}
        />
        <NavCard
          href={`/engagements/${id}/findings`}
          icon={<FileSearch className="h-5 w-5" />}
          title="Findings"
          description={`${engagement._count.findings} confirmed`}
        />
        <NavCard
          href={`/engagements/${id}/ingest`}
          icon={<Upload className="h-5 w-5" />}
          title="Ingest"
          description="Import tool output"
        />
        <NavCard
          href={`/engagements/${id}/report`}
          icon={<FileText className="h-5 w-5" />}
          title="Report"
          description="Draft & export"
        />
        <NavCard
          href={`/engagements/${id}/whiteboard`}
          icon={<PenLine className="h-5 w-5" />}
          title="Whiteboard"
          description="Plan your steps"
        />
        <NavCard
          href={`/engagements/${id}/forum`}
          icon={<Bot className="h-5 w-5" />}
          title="AI Forum"
          description="Ask AI about findings"
        />
        <NavCard
          href={`/engagements/${id}/agent`}
          icon={<Bot className="h-5 w-5" />}
          title="Agent"
          description="Autonomous assistant"
        />
        {closingSoon && (
          <NavCard
            href={`/engagements/${id}/closing`}
            icon={<BookOpen className="h-5 w-5" />}
            title="Closing view"
            description="Triage before close"
            highlight
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Finding distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {[
              { label: "Critical", count: severityCounts.critical, color: "bg-red-600" },
              { label: "High", count: severityCounts.high, color: "bg-orange-500" },
              { label: "Medium", count: severityCounts.medium, color: "bg-yellow-500" },
              { label: "Low", count: severityCounts.low, color: "bg-blue-500" },
              { label: "Info", count: severityCounts.info, color: "bg-gray-400" },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function NavCard({
  href,
  icon,
  title,
  description,
  highlight,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 hover:shadow-sm transition-all ${
        highlight
          ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
          : "hover:bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={highlight ? "text-amber-700" : "text-primary"}>{icon}</span>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    active: "bg-green-100 text-green-800 border border-green-200",
    closing: "bg-amber-100 text-amber-800 border border-amber-200",
    complete: "bg-gray-100 text-gray-600 border border-gray-200",
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${classes[status] ?? classes.active}`}>
      {status}
    </span>
  )
}
