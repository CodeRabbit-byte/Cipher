"use client"

import { useState } from "react"
import type { DuplicateCandidate, DeduplicationDecision, DeduplicationAction } from "@/types"
import { SeverityBadge } from "@/components/findings/SeverityBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeftRight, Copy, Flag } from "lucide-react"

interface Props {
  candidates: DuplicateCandidate[]
  onDecide: (decisions: DeduplicationDecision[]) => void
  onCancel: () => void
}

export function DeduplicationDialog({ candidates, onDecide, onCancel }: Props) {
  const [index, setIndex] = useState(0)
  const [decisions, setDecisions] = useState<DeduplicationDecision[]>([])

  const current = candidates[index]

  function decide(action: DeduplicationAction) {
    const newDecisions = [...decisions, { candidate: current, action }]
    setDecisions(newDecisions)

    if (index + 1 >= candidates.length) {
      onDecide(newDecisions)
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold">Deduplication check</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Potential duplicate {index + 1} of {candidates.length}
        </p>
      </div>

      <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        <span className="font-medium">Match reason: </span>
        {current.matchReasons.join(" · ")}
        <span className="ml-2 text-blue-600">
          ({Math.round(current.similarity * 100)}% similarity)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Incoming
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={current.incoming.severity} />
              <span className="text-sm font-medium">{current.incoming.title}</span>
            </div>
            {current.incoming.host && (
              <p className="text-xs font-mono text-muted-foreground">
                {current.incoming.host}
                {current.incoming.port ? `:${current.incoming.port}` : ""}
              </p>
            )}
            <p className="text-xs text-muted-foreground line-clamp-3">
              {current.incoming.description}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Existing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={current.existing.severity} />
              <span className="text-sm font-medium">{current.existing.title}</span>
            </div>
            {current.existing.host && (
              <p className="text-xs font-mono text-muted-foreground">
                {current.existing.host}
                {current.existing.port ? `:${current.existing.port}` : ""}
              </p>
            )}
            <p className="text-xs text-muted-foreground line-clamp-3">
              {current.existing.description}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="default"
          className="flex-1 gap-2"
          onClick={() => decide("merge")}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Merge
          <span className="text-xs opacity-70">(keep higher severity + combine evidence)</span>
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => decide("keep_both")}
        >
          <Copy className="h-4 w-4" />
          Keep both
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => decide("mark_distinct")}
        >
          <Flag className="h-4 w-4" />
          Mark as distinct
        </Button>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel import
        </Button>
      </div>
    </div>
  )
}
