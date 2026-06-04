"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PromoteDialog } from "./PromoteDialog"
import { Archive, TrendingUp, Trash2 } from "lucide-react"

interface Observation {
  id: string
  content: string
  source: string
  host: string | null | undefined
  status: string
  createdAt: string
  engagementId: string
}

interface Props {
  observation: Observation
  engagementId: string
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onPromoted: (id: string, findingId: string) => void
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  burp: "Burp",
  nmap: "nmap",
  nuclei: "Nuclei",
  nessus: "Nessus",
}

export function ObservationCard({ observation, engagementId, onArchive, onDelete, onPromoted }: Props) {
  const [promoteOpen, setPromoteOpen] = useState(false)

  const isArchived = observation.status === "archived"
  const isPromoted = observation.status === "promoted"

  return (
    <div
      className={`border rounded-lg p-4 transition-opacity ${
        isArchived ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm whitespace-pre-wrap break-words">{observation.content}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              {new Date(observation.createdAt).toLocaleString()}
            </span>
            <Badge variant="outline" className="text-xs py-0">
              {SOURCE_LABELS[observation.source] ?? observation.source}
            </Badge>
            {observation.host && (
              <span className="text-xs text-muted-foreground font-mono">{observation.host}</span>
            )}
            {isPromoted && (
              <Badge className="text-xs py-0 bg-green-100 text-green-800 border-green-200">
                Promoted
              </Badge>
            )}
            {isArchived && (
              <Badge variant="secondary" className="text-xs py-0">
                Archived
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0">
          {!isArchived && !isPromoted && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setPromoteOpen(true)}
              >
                <TrendingUp className="h-3 w-3" />
                Promote
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() => onArchive(observation.id)}
              >
                <Archive className="h-3 w-3" />
                Archive
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (confirm("Delete this observation? This cannot be undone.")) {
                onDelete(observation.id)
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <PromoteDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        observation={observation}
        engagementId={engagementId}
        onPromoted={onPromoted}
      />
    </div>
  )
}
