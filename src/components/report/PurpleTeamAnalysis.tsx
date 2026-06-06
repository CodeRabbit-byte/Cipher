"use client"

import { useState, useCallback } from "react"
import { Sword, Shield, Loader2, Swords, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FindingChainLink } from "@/types"

interface Props {
  engagementId: string
  findingChain: FindingChainLink[]
  disabled?: boolean
}

function renderMarkdown(text: string): JSX.Element {
  const lines = text.split("\n")
  const elements: JSX.Element[] = []

  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      elements.push(
        <p key={i} className="font-bold text-sm mt-3 mb-1">
          {line.slice(3)}
        </p>
      )
    } else if (line.startsWith("### ")) {
      elements.push(
        <p key={i} className="font-semibold text-xs mt-2 mb-0.5">
          {line.slice(4)}
        </p>
      )
    } else if (line.match(/^(\d+)\. /)) {
      const match = line.match(/^(\d+)\. (.*)$/)
      if (match) {
        elements.push(
          <p key={i} className="text-sm leading-relaxed pl-4">
            <span className="font-medium mr-1">{match[1]}.</span>
            {match[2]}
          </p>
        )
      }
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <p key={i} className="text-sm leading-relaxed pl-4 flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-60" />
          <span>{line.slice(2)}</span>
        </p>
      )
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />)
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed">
          {line}
        </p>
      )
    }
  })

  return <div className="space-y-0.5">{elements}</div>
}

export function PurpleTeamAnalysis({ engagementId, findingChain, disabled }: Props) {
  const [redContent, setRedContent] = useState("")
  const [blueContent, setBlueContent] = useState("")
  const [redLoading, setRedLoading] = useState(false)
  const [blueLoading, setBlueLoading] = useState(false)
  const [redError, setRedError] = useState("")
  const [blueError, setBlueError] = useState("")

  const streamPerspective = useCallback(
    async (
      perspective: "red" | "blue",
      setContent: (v: string | ((prev: string) => string)) => void,
      setLoading: (v: boolean) => void,
      setError: (v: string) => void
    ) => {
      setLoading(true)
      setContent("")
      setError("")

      try {
        const res = await fetch("/api/ai/purple-team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ engagementId, perspective, findingChain }),
        })

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "Request failed")
          let message = errText || "Request failed"
          try {
            const parsed = JSON.parse(errText)
            if (parsed.error) message = parsed.error
          } catch {
            // leave as raw text
          }
          setError(message)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setContent(accumulated)
        }
        accumulated += decoder.decode()
        setContent(accumulated)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    },
    [engagementId, findingChain]
  )

  const runAnalysis = useCallback(() => {
    if (redLoading || blueLoading) return

    Promise.all([
      streamPerspective("red", setRedContent, setRedLoading, setRedError),
      streamPerspective("blue", setBlueContent, setBlueLoading, setBlueError),
    ])
  }, [redLoading, blueLoading, streamPerspective])

  const isLoading = redLoading || blueLoading
  const hasStarted = redContent || blueContent || redError || blueError || isLoading

  return (
    <div className="space-y-4">
      {/* Trigger button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-purple-600" />
          <h2 className="text-sm font-semibold">Purple Team Analysis</h2>
        </div>
        <Button
          size="sm"
          onClick={runAnalysis}
          disabled={isLoading || disabled}
          className="gap-1.5"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Swords className="h-4 w-4" />
          )}
          {isLoading ? "Analysing…" : hasStarted ? "Re-run Analysis" : "Run Purple Team Analysis"}
        </Button>
      </div>

      {disabled && !hasStarted && (
        <p className="text-sm text-muted-foreground">
          Add findings to the engagement to run a purple team analysis.
        </p>
      )}

      {/* Panels */}
      {hasStarted && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Red Team Panel */}
          <div className="border border-rose-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border-b border-rose-200">
              <Sword className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="text-sm font-semibold text-rose-700">
                Red Team — Attack Analysis
              </span>
              {redLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500 ml-auto" />
              )}
            </div>
            <div className="p-4 min-h-[180px]">
              {redError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                  <p className="text-sm text-rose-700">{redError}</p>
                </div>
              ) : redLoading && !redContent ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing attack surface…
                </div>
              ) : redContent ? (
                <div className="text-rose-900">{renderMarkdown(redContent)}</div>
              ) : null}
            </div>
          </div>

          {/* Blue Team Panel */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-200">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-sm font-semibold text-blue-700">
                Blue Team — Defensive Strategy
              </span>
              {blueLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 ml-auto" />
              )}
            </div>
            <div className="p-4 min-h-[180px]">
              {blueError ? (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">{blueError}</p>
                </div>
              ) : blueLoading && !blueContent ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building defensive strategy…
                </div>
              ) : blueContent ? (
                <div className="text-blue-900">{renderMarkdown(blueContent)}</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
