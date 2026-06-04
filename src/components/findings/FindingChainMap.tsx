"use client"

import { SeverityBadge } from "./SeverityBadge"
import { ArrowRight } from "lucide-react"

interface Finding {
  id: string
  title: string
  severity: string
}

interface ChainLink {
  from: string
  to: string
  explanation: string
}

interface Props {
  findings: Finding[]
  chains: ChainLink[]
}

export function FindingChainMap({ findings, chains }: Props) {
  if (chains.length === 0) return null

  const findingMap = new Map(findings.map((f) => [f.id, f]))

  return (
    <div className="space-y-2">
      {chains.map((chain, i) => {
        const from = findingMap.get(chain.from)
        const to = findingMap.get(chain.to)
        if (!from || !to) return null
        return (
          <div key={i} className="flex items-center gap-2 text-sm p-3 border rounded-md bg-muted/30">
            <div className="flex items-center gap-1.5">
              <SeverityBadge severity={from.severity} />
              <span className="font-medium text-sm truncate max-w-[200px]">{from.title}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1.5">
              <SeverityBadge severity={to.severity} />
              <span className="font-medium text-sm truncate max-w-[200px]">{to.title}</span>
            </div>
            {chain.explanation && (
              <span className="text-muted-foreground text-xs ml-auto">{chain.explanation}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
