"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, StickyNote } from "lucide-react"

interface Note {
  id: string
  x: number
  y: number
  text: string
  color: string
}

const COLORS = [
  { label: "General",         bg: "bg-yellow-200",  border: "border-yellow-300",  hex: "#fef08a" },
  { label: "Recon",           bg: "bg-blue-200",    border: "border-blue-300",    hex: "#bfdbfe" },
  { label: "Exploitation",    bg: "bg-red-200",     border: "border-red-300",     hex: "#fecaca" },
  { label: "Post-Exploit",    bg: "bg-orange-200",  border: "border-orange-300",  hex: "#fed7aa" },
  { label: "Reporting",       bg: "bg-green-200",   border: "border-green-300",   hex: "#bbf7d0" },
]

function colorConfig(hex: string) {
  return COLORS.find((c) => c.hex === hex) ?? COLORS[0]
}

function storageKey(engagementId: string) {
  return `whiteboard-${engagementId}`
}

function loadNotes(engagementId: string): Note[] {
  try {
    const raw = localStorage.getItem(storageKey(engagementId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotes(engagementId: string, notes: Note[]) {
  localStorage.setItem(storageKey(engagementId), JSON.stringify(notes))
}

export function Whiteboard({ engagementId, engagementName }: { engagementId: string; engagementName: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [activeColor, setActiveColor] = useState(COLORS[0].hex)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNotes(loadNotes(engagementId))
  }, [engagementId])

  useEffect(() => {
    if (notes.length > 0 || localStorage.getItem(storageKey(engagementId))) {
      saveNotes(engagementId, notes)
    }
  }, [notes, engagementId])

  const addNote = useCallback(() => {
    const board = boardRef.current
    const x = board ? Math.random() * (board.clientWidth - 220) + 20 : 100
    const y = board ? Math.random() * (board.clientHeight - 180) + 20 : 100
    const note: Note = {
      id: Math.random().toString(36).slice(2),
      x: Math.max(10, x),
      y: Math.max(10, y),
      text: "",
      color: activeColor,
    }
    setNotes((prev) => [...prev, note])
  }, [activeColor])

  const updateText = useCallback((id: string, text: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)))
  }, [])

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent, note: Note) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return
    e.preventDefault()
    const board = boardRef.current
    if (!board) return
    const rect = board.getBoundingClientRect()
    setDragging({
      id: note.id,
      offsetX: e.clientX - rect.left - note.x,
      offsetY: e.clientY - rect.top - note.y,
    })
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging || !boardRef.current) return
      const rect = boardRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left - dragging.offsetX, rect.width - 220))
      const y = Math.max(0, Math.min(e.clientY - rect.top - dragging.offsetY, rect.height - 180))
      setNotes((prev) => prev.map((n) => (n.id === dragging.id ? { ...n, x, y } : n)))
    }
    function onMouseUp() {
      setDragging(null)
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [dragging])

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="shrink-0 border-b px-5 py-3 flex items-center gap-4 bg-background">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{engagementName}</span>
          <span className="text-muted-foreground text-sm">— Whiteboard</span>
        </div>

        <div className="flex items-center gap-1 ml-4">
          {COLORS.map((c) => (
            <button
              key={c.hex}
              title={c.label}
              onClick={() => setActiveColor(c.hex)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                activeColor === c.hex ? "scale-125 border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 ml-1">
          {COLORS.map((c) => (
            <span key={c.hex} className="text-[10px] text-muted-foreground hidden sm:inline">
              {activeColor === c.hex ? c.label : ""}
            </span>
          ))}
        </div>

        <Button size="sm" className="ml-auto gap-1.5" onClick={addNote}>
          <Plus className="h-3.5 w-3.5" />
          Add note
        </Button>
      </div>

      {/* Legend */}
      <div className="shrink-0 px-5 py-1.5 border-b bg-muted/20 flex items-center gap-4 flex-wrap">
        {COLORS.map((c) => (
          <div key={c.hex} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: c.hex }} />
            <span className="text-[11px] text-muted-foreground">{c.label}</span>
          </div>
        ))}
        <span className="text-[11px] text-muted-foreground ml-auto">
          {notes.length} note{notes.length !== 1 ? "s" : ""} · auto-saved
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={boardRef}
        className="flex-1 relative overflow-hidden bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px]"
        style={{ cursor: dragging ? "grabbing" : "default" }}
      >
        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground">
              <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Click <strong>Add note</strong> to start planning your pentest steps</p>
            </div>
          </div>
        )}

        {notes.map((note) => {
          const cfg = colorConfig(note.color)
          return (
            <div
              key={note.id}
              style={{ left: note.x, top: note.y, position: "absolute", width: 210 }}
              className={`rounded-lg border shadow-md ${cfg.bg} ${cfg.border} select-none`}
              onMouseDown={(e) => onMouseDown(e, note)}
            >
              {/* Note header — drag handle */}
              <div
                className="flex items-center justify-between px-3 py-1.5 rounded-t-lg cursor-grab active:cursor-grabbing"
                style={{ backgroundColor: note.color }}
              >
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-black/20" />
                  <span className="w-2 h-2 rounded-full bg-black/20" />
                  <span className="w-2 h-2 rounded-full bg-black/20" />
                </div>
                <span className="text-[10px] font-medium text-black/50">{cfg.label}</span>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => deleteNote(note.id)}
                  className="text-black/40 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Text area */}
              <textarea
                value={note.text}
                onChange={(e) => updateText(note.id, e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Type your note…"
                className="w-full resize-none bg-transparent text-sm text-black/80 placeholder:text-black/30 p-3 pt-2 outline-none rounded-b-lg"
                rows={4}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
