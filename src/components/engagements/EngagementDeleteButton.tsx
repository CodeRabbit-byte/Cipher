"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

export function EngagementDeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm("Delete this engagement and all its observations and findings? This cannot be undone.")) return
    setDeleting(true)
    await fetch(`/api/engagements/${id}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={deleting}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
