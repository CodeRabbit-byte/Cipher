"use client"

import { useState, useRef, useCallback } from "react"
import { Palette, Upload, Check, ImageIcon, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { PRESETS, getStoredTheme, saveTheme, extractDominantHue } from "@/lib/theme"
import type { StoredTheme } from "@/lib/theme"

function swatchColor(hue: number) {
  return `hsl(${hue}, 70%, 50%)`
}

function previewBg(hue: number, mode: "dark" | "light") {
  return mode === "dark" ? `hsl(${hue}, 84%, 4.9%)` : `hsl(${hue}, 30%, 99%)`
}

function previewSurface(hue: number, mode: "dark" | "light") {
  return mode === "dark" ? `hsl(${hue}, 32.6%, 17.5%)` : `hsl(${hue}, 40%, 96%)`
}

function previewText(mode: "dark" | "light") {
  return mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)"
}

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false)

  const stored = getStoredTheme()
  const [selectedId, setSelectedId] = useState<string>(stored?.id ?? "default")
  const [selectedHue, setSelectedHue] = useState<number>(stored?.hue ?? 222)
  const [selectedMode, setSelectedMode] = useState<"dark" | "light">(stored?.mode ?? "dark")

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extractedHue, setExtractedHue] = useState<number | null>(null)
  const [draggingOver, setDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleOpen() {
    const s = getStoredTheme()
    setSelectedId(s?.id ?? "default")
    setSelectedHue(s?.hue ?? 222)
    setSelectedMode(s?.mode ?? "dark")
    setImagePreview(null)
    setExtractedHue(null)
    setOpen(true)
  }

  function selectPreset(id: string, hue: number) {
    setSelectedId(id)
    setSelectedHue(hue)
    setExtractedHue(null)
    setImagePreview(null)
  }

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const hue = extractDominantHue(img)
      URL.revokeObjectURL(url)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
        setExtractedHue(hue)
        setSelectedId("custom")
        setSelectedHue(hue)
      }
      reader.readAsDataURL(file)
    }
    img.src = url
  }, [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDraggingOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleApply() {
    const theme: StoredTheme = { id: selectedId, hue: selectedHue, mode: selectedMode }
    saveTheme(theme)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Palette className="h-4 w-4" />
        Appearance
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Appearance</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Light / Dark toggle */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Mode
              </p>
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMode(m)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                      selectedMode === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {m === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {m === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>

            {/* Preset swatches */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Color theme
              </p>
              <div className="grid grid-cols-7 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    title={p.label}
                    onClick={() => selectPreset(p.id, p.hue)}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <span
                      className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                      style={{
                        backgroundColor: swatchColor(p.hue),
                        borderColor:
                          selectedId === p.id && extractedHue === null
                            ? "white"
                            : "transparent",
                        boxShadow:
                          selectedId === p.id && extractedHue === null
                            ? `0 0 0 1px white, 0 0 0 3px ${swatchColor(p.hue)}`
                            : "none",
                      }}
                    >
                      {selectedId === p.id && extractedHue === null && (
                        <Check className="h-3 w-3 text-white drop-shadow" />
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image extraction */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Match image
              </p>

              {imagePreview && extractedHue !== null ? (
                <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
                  <img
                    src={imagePreview}
                    alt="Uploaded"
                    className="w-14 h-14 rounded-md object-cover shrink-0 border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Color extracted</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Hue {extractedHue}° — subtly applied to all surfaces
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: swatchColor(extractedHue) }}
                      />
                      <div
                        className="flex-1 h-4 rounded"
                        style={{
                          background: `linear-gradient(to right, ${previewBg(extractedHue, selectedMode)}, ${previewSurface(extractedHue, selectedMode)})`,
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      />
                    </div>
                  </div>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setImagePreview(null)
                      setExtractedHue(null)
                      setSelectedId(getStoredTheme()?.id ?? "default")
                      setSelectedHue(getStoredTheme()?.hue ?? 222)
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                    draggingOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/10"
                  }`}
                  onDragEnter={() => setDraggingOver(true)}
                  onDragLeave={() => setDraggingOver(false)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFileInput}
                  />
                  <ImageIcon className="h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Drop an image or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Dominant color will tint the UI, like WhatsApp
                  </p>
                </div>
              )}
            </div>

            {/* Live preview strip */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Preview
              </p>
              <div
                className="rounded-lg p-3 flex items-center gap-3"
                style={{
                  backgroundColor: previewBg(selectedHue, selectedMode),
                  border: `1px solid ${previewSurface(selectedHue, selectedMode)}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-md shrink-0"
                  style={{ backgroundColor: previewSurface(selectedHue, selectedMode) }}
                />
                <div className="flex-1 space-y-1.5">
                  <div
                    className="h-2 rounded-full w-3/4"
                    style={{ backgroundColor: previewSurface(selectedHue, selectedMode) }}
                  />
                  <div
                    className="h-2 rounded-full w-1/2"
                    style={{ backgroundColor: previewSurface(selectedHue, selectedMode) }}
                  />
                </div>
                <div
                  className="w-6 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: swatchColor(selectedHue) }}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
