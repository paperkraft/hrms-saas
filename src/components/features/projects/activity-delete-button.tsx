"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui"
import { deleteActivityLog } from "@/actions/activity"

export function ActivityDeleteButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this activity log?")) return

    setLoading(true)
    const result = await deleteActivityLog(id)
    if (result.success) {
      toast.success("Activity log deleted")
      router.refresh()
    } else {
      toast.error(result.error || "Failed to delete activity log")
    }
    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
      onClick={handleDelete}
      disabled={loading}
      title="Delete activity record"
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}
