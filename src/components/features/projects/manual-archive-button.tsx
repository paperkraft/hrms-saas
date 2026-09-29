"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Archive, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { triggerManualArchive } from "@/actions/activity"
import { useRouter } from "next/navigation"

export function ManualArchiveButton() {
  const [isArchiving, setIsArchiving] = useState(false)
  const router = useRouter()

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to manually archive old activity logs?")) return

    setIsArchiving(true)
    try {
      const res = await triggerManualArchive()
      if (res.success) {
        toast.success(`Archived ${res.count} old activity logs successfully!`)
        router.refresh()
      } else {
        toast.error(res.error || "Failed to archive logs")
      }
    } catch (e) {
      toast.error("An error occurred during archival")
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="h-8 text-[11px] font-bold text-amber-600 border-amber-200 hover:bg-amber-50"
      onClick={handleArchive}
      disabled={isArchiving}
    >
      {isArchiving ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <Archive className="size-3.5 mr-2" />}
      Manual Archive
    </Button>
  )
}
