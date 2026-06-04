"use client"

import { useState } from "react"
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  low: "#2563eb",
  info: "#6b7280",
}

interface Finding {
  id: string
  title: string
  description: string
  severity: string
  host?: string | null
  port?: number | null
  cvss?: number | null
  cveIds?: string | null
  remediationNote?: string | null
  evidence?: string | null
}

export interface ReportExportProps {
  engagementName: string
  clientName: string
  summary: string
  findings: Finding[]
}

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 48, color: "#111827" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  client: { fontSize: 12, color: "#6b7280" },
  dateText: { fontSize: 9, color: "#9ca3af", marginTop: 6, marginBottom: 28 },
  sectionHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 10,
  },
  section: { marginBottom: 24 },
  summaryText: { fontSize: 10, lineHeight: 1.6, color: "#374151" },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 12, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  badge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  findingTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", flex: 1 },
  host: { fontSize: 8, color: "#6b7280", marginBottom: 6 },
  label: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#374151", marginTop: 6, marginBottom: 2 },
  value: { fontSize: 9, color: "#374151", lineHeight: 1.5 },
  meta: { fontSize: 8, color: "#9ca3af", fontFamily: "Helvetica-Oblique", marginTop: 6 },
  empty: { fontSize: 10, color: "#6b7280" },
})

function ReportDoc({
  engagementName,
  clientName,
  summary,
  findings,
  date,
}: ReportExportProps & { date: string }) {
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )

  return (
    <Document title={`${engagementName} — Security Report`} author="CIPHER">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{engagementName}</Text>
        <Text style={s.client}>{clientName}</Text>
        <Text style={s.dateText}>Exported {date}</Text>

        {summary ? (
          <View style={s.section}>
            <Text style={s.sectionHeading}>Executive Summary</Text>
            <Text style={s.summaryText}>{summary}</Text>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionHeading}>Findings ({sorted.length})</Text>
          {sorted.length === 0 ? (
            <Text style={s.empty}>No confirmed findings.</Text>
          ) : (
            sorted.map((f) => (
              <View key={f.id} style={s.card} wrap={false}>
                <View style={s.row}>
                  <Text style={[s.badge, { backgroundColor: SEVERITY_COLOR[f.severity] ?? "#6b7280" }]}>
                    {f.severity.toUpperCase()}
                  </Text>
                  <Text style={s.findingTitle}>{f.title}</Text>
                </View>

                {(f.host || f.port) ? (
                  <Text style={s.host}>
                    {f.host ?? ""}{f.port ? `:${f.port}` : ""}
                  </Text>
                ) : null}

                <Text style={s.label}>Description</Text>
                <Text style={s.value}>{f.description}</Text>

                {f.remediationNote ? (
                  <>
                    <Text style={s.label}>Remediation</Text>
                    <Text style={s.value}>{f.remediationNote}</Text>
                  </>
                ) : null}

                {f.evidence ? (
                  <>
                    <Text style={s.label}>Evidence</Text>
                    <Text style={s.value}>{f.evidence}</Text>
                  </>
                ) : null}

                {(f.cveIds || f.cvss != null) ? (
                  <Text style={s.meta}>
                    {[f.cveIds, f.cvss != null ? `CVSS ${f.cvss}` : null].filter(Boolean).join("  ·  ")}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  )
}

export function ReportExport({ engagementName, clientName, summary, findings }: ReportExportProps) {
  const [generating, setGenerating] = useState(false)

  async function handleDownload() {
    setGenerating(true)
    try {
      const date = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      const blob = await pdf(
        <ReportDoc
          engagementName={engagementName}
          clientName={clientName}
          summary={summary}
          findings={findings}
          date={date}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${engagementName.toLowerCase().replace(/\s+/g, "-")}-report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={generating} className="gap-1.5">
      <Download className="h-4 w-4" />
      {generating ? "Generating…" : "Download PDF"}
    </Button>
  )
}
