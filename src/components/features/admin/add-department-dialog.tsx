"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Building2, Layers } from "lucide-react"
import { createDepartment } from "@/actions/department"
import { toast } from "sonner"

type DepartmentOption = { id: string; name: string; parentDepartmentId?: string | null }

export function AddDepartmentDialog({ departments }: { departments: DepartmentOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [parentDepartmentId, setParentDepartmentId] = useState<string>("none")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Department name is required")
      return
    }

    setLoading(true)
    setError("")

    const res = await createDepartment(
      name.trim(),
      parentDepartmentId === "none" ? null : parentDepartmentId,
      description.trim() || null
    )
    setLoading(false)

    if (res.success) {
      toast.success(`Department "${name}" created successfully!`)
      setOpen(false)
      setName("")
      setDescription("")
      setParentDepartmentId("none")
    } else {
      setError(res.error || "Failed to create department")
      toast.error(res.error || "Failed to create department")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5 shrink-0">
          <Plus className="size-4" /> Add Department
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-[calc(100vw-1.5rem)] rounded-md border border-border/80 shadow-2xl bg-card p-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-border/70 bg-card pr-12 sm:pr-14">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md flex items-center justify-center border border-primary/20 bg-primary/10 text-primary shrink-0">
              <Building2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold tracking-tight text-foreground">
                Create Department
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Add a new operational department or sub-unit
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Department Name</Label>
            <Input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Civil Engineering, Operations, Design"
              className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Parent Department (Optional)</Label>
            <Select value={parentDepartmentId} onValueChange={setParentDepartmentId}>
              <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                <SelectValue placeholder="Select parent unit (optional)" />
              </SelectTrigger>
              <SelectContent className="rounded-md border-border/80">
                <SelectItem value="none" className="text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="size-3.5" /> None (Top-Level Department)
                  </div>
                </SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <Layers className="size-3.5 text-primary" /> {dept.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground font-medium">
              Assign to create a nested sub-department hierarchy
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Description (Optional)</Label>
            <Textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of this department's functions, goals, or responsibilities..."
              className="min-h-[80px] bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 resize-y"
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              className="h-9 px-4 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Create Department"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
