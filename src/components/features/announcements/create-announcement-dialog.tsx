"use client"

import { useState } from "react"
import { Megaphone, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createAnnouncement } from "@/actions/announcement"
import { Priority } from "@prisma/client"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { useRouter } from "next/navigation"

interface CreateAnnouncementDialogProps {
  departments: { id: string; name: string }[]
}

export function CreateAnnouncementDialog({ departments }: CreateAnnouncementDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form State
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [priority, setPriority] = useState<Priority>("LOW")
  const [targetDept, setTargetDept] = useState("all")

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return

    setLoading(true)
    const res = await createAnnouncement({
      title,
      content,
      priority,
      departmentId: targetDept === "all" ? undefined : targetDept,
    })

    if (res.success && res.data) {
      setOpen(false)
      setTitle("")
      setContent("")
      setPriority("LOW")
      setTargetDept("all")
      router.refresh()
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-3 sm:px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md transition-colors gap-1.5 sm:gap-2 cursor-pointer shadow-xs shrink-0">
          <Plus className="size-4" />
          <span>
            <span className="hidden sm:inline">Broadcast </span>Notice
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 rounded-md border border-border shadow-xl overflow-hidden w-[calc(100%-2rem)] sm:max-w-[620px] max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md flex items-center justify-center border bg-primary/10 text-primary border-primary/20 shrink-0">
              <Megaphone className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Broadcast Company Notice
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Send an official announcement to all organization members or a specific department
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Notice Title</label>
                <Input
                  placeholder="e.g. Office Scheduled Maintenance & Power Interruption"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9.5 bg-background border-border/80 rounded-lg text-xs font-medium"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Priority Level</label>
                <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
                  <SelectTrigger className="w-full h-9.5 bg-background border-border/80 rounded-lg text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="LOW" className="text-xs">General / Normal</SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs">Medium Priority</SelectItem>
                    <SelectItem value="HIGH" className="text-xs">High / Important</SelectItem>
                    <SelectItem value="URGENT" className="text-xs">Urgent / Action Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Target Audience</label>
                <Select value={targetDept} onValueChange={setTargetDept}>
                  <SelectTrigger className="w-full h-9.5 bg-background border-border/80 rounded-lg text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all" className="text-xs">🏢 All Departments (Company-Wide)</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">📍 {d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Notice Message Content</label>
              <RichTextEditor
                placeholder="Write the full announcement message, details, and action items..."
                value={content}
                onChange={setContent}
                className="min-h-[160px] bg-background border border-border/80 rounded-lg text-xs font-medium focus-within:ring-2 focus-within:ring-primary/20"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9 px-4 text-xs font-medium rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !title || !content}
                className="h-9 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-lg shadow-xs cursor-pointer"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin mx-auto" /> : "Publish Notice"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
