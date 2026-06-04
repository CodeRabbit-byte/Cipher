"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewEngagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      clientName: formData.get("clientName") as string,
      clientBrief: formData.get("clientBrief") as string,
      scope: formData.get("scope") as string,
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string).toISOString() : null,
    }

    const res = await fetch("/api/engagements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Failed to create engagement")
      return
    }

    const created = await res.json()
    router.push(`/engagements/${created.id}/capture`)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-6">New engagement</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engagement details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Engagement name *</Label>
              <Input id="name" name="name" required placeholder="Q2 2026 Web App Assessment" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">Client name *</Label>
              <Input id="clientName" name="clientName" required placeholder="Acme Corp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientBrief">
                Client brief
                <span className="text-muted-foreground font-normal ml-1 text-xs">
                  (industry, risk tolerance, tech stack — 2–3 sentences)
                </span>
              </Label>
              <Textarea
                id="clientBrief"
                name="clientBrief"
                rows={3}
                placeholder="Acme operates a SaaS platform in fintech. They handle PII and payment data, with high sensitivity to reputational risk. Stack is React + Node.js with PostgreSQL."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Textarea
                id="scope"
                name="scope"
                rows={2}
                placeholder="app.acme.com, api.acme.com, 10.0.0.0/24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create engagement"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
