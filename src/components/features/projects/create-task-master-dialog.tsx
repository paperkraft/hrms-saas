"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { Plus, ListChecks, Edit3, RotateCw } from "lucide-react"
import { createTaskMaster, updateTaskMaster } from "@/actions/task-master"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  name: z.string().min(2, "Task name is required"),
  activity: z.string().optional(),
  defaultDurationDays: z.coerce.number().min(0, "Duration must be positive"),
  departmentId: z.string().min(1, "Department is required"),
})

interface CreateTaskMasterDialogProps {
  departments: { id: string; name: string; parentDepartment?: { id: string; name: string } | null }[]
  taskMaster?: any // For editing
}

export function CreateTaskMasterDialog({ departments, taskMaster }: CreateTaskMasterDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const isEditing = !!taskMaster

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: taskMaster?.name || "",
      activity: taskMaster?.activity || "",
      defaultDurationDays: taskMaster?.defaultDurationDays || 1,
      departmentId: taskMaster?.departmentId || "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    try {
      const result = isEditing
        ? await updateTaskMaster(taskMaster.id, values)
        : await createTaskMaster(values)

      if (result.success) {
        toast.success(isEditing ? "Task template updated" : "Task template created")
        setOpen(false)
        if (!isEditing) form.reset()
        router.refresh()
      } else {
        toast.error(result.error || `Failed to ${isEditing ? "update" : "create"} template`)
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            title="Edit template"
          >
            <Edit3 className="size-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="h-9 px-3.5 text-xs font-semibold gap-2 shadow-xs cursor-pointer rounded-md">
            <Plus className="size-4" />
            <span>New Task Template</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="p-0 rounded-2xl border border-border shadow-2xl overflow-hidden sm:max-w-[480px] max-h-[88vh] flex flex-col gap-0 bg-card"
      >
        <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b border-border/80">
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                {isEditing ? <Edit3 className="size-4.5" /> : <ListChecks className="size-5" />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                  {isEditing ? "Edit Task Template" : "Create Task Template"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isEditing ? "Modify task template activity and turnaround duration" : "Add a standardized operational task to the organization catalog"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 overscroll-contain">
          <Form {...form}>
            <form id="task-master-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">Task Template Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Architectural Design Draft"
                        className="h-9 text-xs rounded-lg bg-background"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="activity"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">Activity Type / Category</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Design, Analysis, Civil Testing"
                        className="h-9 text-xs rounded-lg bg-background"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField
                  control={form.control}
                  name="defaultDurationDays"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-foreground">Default Duration (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="e.g. 3 (0 for continuous)"
                          className="h-9 text-xs rounded-lg bg-background font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-foreground">Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl max-h-56">
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id} className="text-xs">
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </div>

        {/* Sticky Action Footer */}
        <div className="shrink-0 px-5 py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="h-9 px-4 text-xs cursor-pointer rounded-md"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="task-master-form"
            size="sm"
            disabled={loading}
            className="h-9 px-5 text-xs font-semibold gap-2 shadow-xs cursor-pointer rounded-md"
          >
            {loading && <RotateCw className="size-3.5 animate-spin" />}
            <span>{isEditing ? "Update Template" : "Create Template"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
