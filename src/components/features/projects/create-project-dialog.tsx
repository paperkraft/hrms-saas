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
} from "@/components/ui"
import {
  Plus,
  Briefcase,
  Users,
  Calendar,
  Clock,
  Loader2,
  FolderPlus,
  ShieldCheck
} from "lucide-react"
import { createProject } from "@/actions/projects/core"
import { toast } from "sonner"
import { getEmployeesForDropdown } from "@/actions/user"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { useRouter } from "next/navigation"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

const formSchema = z.object({
  name: z.string().min(2, "Project name is required"),
  projectCoordinateName: z.string().optional(),
  documentManagerName: z.string().optional(),
  description: z.string().optional(),
  client: z.string().optional(),
  timeLimit: z.string().optional(),
  dateOfWorkOrder: z.string().optional(),
  retentionStartDate: z.string().optional(),
  retentionDurationMonths: z.number().optional(),
})

export function CreateProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [employees, setEmployees] = useState<{ id: string, name: string | null, email: string }[]>([])

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
      name: "",
      projectCoordinateName: "",
      documentManagerName: "",
      description: "",
      client: "",
      timeLimit: "",
      dateOfWorkOrder: "",
      retentionStartDate: "",
      retentionDurationMonths: undefined,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    const result = await createProject({
      ...values,
      timeLimit: values.timeLimit ? new Date(values.timeLimit) : undefined,
      dateOfWorkOrder: values.dateOfWorkOrder ? new Date(values.dateOfWorkOrder) : undefined,
      retentionStartDate: values.retentionStartDate ? new Date(values.retentionStartDate) : undefined,
    })

    if (result.success) {
      toast.success("Project created successfully")
      setOpen(false)
      form.reset()
      router.refresh()
    } else {
      toast.error(result.error || "Failed to create project")
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-2">
          <Plus className="size-4" /> Create Project
        </Button>
      </DialogTrigger>

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
                Create New Project
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Define project deliverables, client parameters, coordinators, and retention timeline
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable Form Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <Form {...form}>
            <form id="create-project-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            form="create-project-form"
            disabled={isSubmitting}
            className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Creating Project...</span>
              </>
            ) : (
              <>
                <Plus className="size-4" />
                <span>Create Project</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
