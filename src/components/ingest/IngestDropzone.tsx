"use client"

import { useCallback, useState } from "react"
import { Upload } from "lucide-react"

interface Props {
  onFileDrop: (file: File) => void
}

export function IngestDropzone({ onFileDrop }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFileDrop(file)
    },
    [onFileDrop]
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileDrop(file)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        {[
          {
            tool: "Burp Suite",
            instruction:
              "Target → Site map → right-click selected hosts → Save selected items → XML format. Community users: use the Logger export.",
          },
          {
            tool: "nmap",
            instruction: "Run with the -oX flag. Example: nmap -sV -oX scan.xml 192.168.1.0/24",
          },
          {
            tool: "Nuclei",
            instruction: "Run with -json -o output.json flag.",
          },
          {
            tool: "Nessus",
            instruction: "Reports → Export → Nessus format (.nessus)",
          },
          {
            tool: "Metasploit",
            instruction: "In msfconsole: db_export -f xml /path/to/export.xml — then drop the .xml here.",
          },
        ].map(({ tool, instruction }) => (
          <div key={tool} className="rounded-lg border p-4 bg-muted/20">
            <p className="font-medium text-sm mb-1">{tool}</p>
            <p className="text-xs text-muted-foreground">{instruction}</p>
          </div>
        ))}
      </div>

      <label
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/10"
        }`}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".xml,.json,.nessus"
          className="sr-only"
          onChange={handleChange}
        />
        <Upload className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">
          Accepts: .xml (Burp / nmap / Metasploit), .json (Nuclei), .nessus
        </p>
      </label>
    </div>
  )
}
