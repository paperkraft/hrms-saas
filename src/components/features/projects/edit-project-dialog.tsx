"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { getEmployeesForDropdown } from "@/actions/user"
import {
  Pencil,
  Briefcase,
  Users,
  Calendar,
  Clock,
  Loader2,
  FolderPlus,
  Save
} from "lucide-react"
import { updateProject } from "@/actions/projects/core"
import { toast } from "sonner"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

const formSchema = z.object({
  name: z.string().min(2, "Project name is required"),
  projectCoordinateName: z.string().optional(),
  documentManagerName: z.string().optional(),
  description: z.string().optional(),
  client: z.string().optional(),
  timeLimit: z.string().optional().nullable(),
  dateOfWorkOrder: z.string().optional().nullable(),
  retentionStartDate: z.string().optional().nullable(),
  retentionDurationMonths: z.number().optional().nullable(),
})

interface EditProjectDialogProps {
  project: any
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function formatDateForInput(date: string | Date | null | undefined): string {
  if (!date) return ""
  try {
    const d = new Date(date)
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0]
  } catch {
    return ""
  }
}

export function EditProjectDialog({
  project,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: EditProjectDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen
  const [employees, setEmployees] = useState<{ id: string, name: string | null, email: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && employees.length === 0) {
      getEmployeesForDropdown().then(res => {
        if (res.success && res.data) {
          setEmployees(res.data)
        }
      })
    }
  }, [open, employees.length])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name || "",
      projectCoordinateName: project?.projectCoordinateName || "",
      documentManagerName: project?.documentManagerName || "",
      description: project?.description || "",
      client: project?.client || "",
      timeLimit: formatDateForInput(project?.timeLimit),
      dateOfWorkOrder: formatDateForInput(project?.dateOfWorkOrder),
      retentionStartDate: formatDateForInput(project?.retentionStartDate),
      retentionDurationMonths: project?.retentionDurationMonths || undefined,
    },
  })

  // Reset form when project changes or dialog opens
  useEffect(() => {
    if (project && open) {
      form.reset({
        name: project.name || "",
        projectCoordinateName: project.projectCoordinateName || "",
        documentManagerName: project.documentManagerName || "",
        description: project.description || "",
        client: project.client || "",
        timeLimit: formatDateForInput(project.timeLimit),
        dateOfWorkOrder: formatDateForInput(project.dateOfWorkOrder),
        retentionStartDate: formatDateForInput(project.retentionStartDate),
        retentionDurationMonths: project.retentionDurationMonths || undefined,
      })
    }
  }, [project, open, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    const result = await updateProject(project.id, {
      ...values,
      timeLimit: values.timeLimit ? new Date(values.timeLimit) : null,
      dateOfWorkOrder: values.dateOfWorkOrder ? new Date(values.dateOfWorkOrder) : null,
      retentionStartDate: values.retentionStartDate ? new Date(values.retentionStartDate) : null,
    })

    if (result.success) {
      toast.success("Project updated successfully")
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update project")
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Pencil className="mr-2 size-3.5 text-sky-600" />
            Edit Project
          </DropdownMenuItem>
        </DialogTrigger>
      )}

      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        aria-describedby={undefined}
        className="sm:max-w-2xl lg:max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card"
      >
        {/* ── Modal Header ── */}
        <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Briefcase className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Edit Project: {project?.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Update project parameters, coordination staff, milestone dates, and retention lifecycle
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable Form Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <Form {...form}>
            <form id="edit-project-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* SECTION 1: Identity & Scope */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <FolderPlus className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Project Identity & Scope
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Project Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Metro Line Extension Phase 2"
                            className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Client / Sponsoring Authority
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Municipal Corporation of Delhi"
                            className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-foreground">
                        Project Scope & Objectives Description
                      </FormLabel>
                      <FormControl>
                        <RichTextEditor
                          placeholder="Provide a comprehensive summary of project deliverables, milestones, and technical scope..."
                          value={field.value || ""}
                          onChange={(html) => field.onChange(html)}
                          className="min-h-[120px] bg-background border border-border/80 rounded-md text-xs font-medium shadow-none focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/40"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* SECTION 2: Coordination & Leadership */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Team Coordination & Document Control
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="projectCoordinateName"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Project Coordinator
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                              <SelectValue placeholder="Select assigned coordinator" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-md border-border/80 max-h-[220px]">
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.name || emp.email} className="text-xs">
                                {emp.name || emp.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="documentManagerName"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Document Manager
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                              <SelectValue placeholder="Select document manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-md border-border/80 max-h-[220px]">
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.name || emp.email} className="text-xs">
                                {emp.name || emp.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* SECTION 3: Timeline & Work Order */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <Calendar className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Project Timeline & Work Order
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateOfWorkOrder"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Date of Work Order
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timeLimit"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Completion Deadline (Time Limit)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* SECTION 4: Retention & Archival */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <Clock className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Retention & Post-Delivery Archival
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="retentionStartDate"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Retention Start Date
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retentionDurationMonths"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Retention Duration (Months)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="e.g. 18 for 1.5 years"
                            className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        </div>

        {/* ── Modal Pinned Footer ── */}
        <div className="px-6 py-4 border-t shrink-0 bg-background/50 border-border/60 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-9 px-4 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-project-form"
            disabled={isSubmitting}
            className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="size-4" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
