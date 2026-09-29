"use client"

import { useState } from "react"
import React from "react"
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
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Label,
} from "@/components/ui"
import { CalendarIcon, Plus, Repeat, Loader2, Layers } from "lucide-react"
import { createRecurringTaskSchedule } from "@/actions/projects/recurring"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

const formSchema = z.object({
  name: z.string().min(2, "Task name is required"),
  description: z.string().optional(),
  assignedToId: z.string().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  nextRunAt: z.date({ required_error: "Start date is required" }),
  taskMasterId: z.string().optional(),
})

interface CreateRecurringScheduleDialogProps {
  projectId: string;
  members: { id: string; name: string | null; departmentId?: string | null }[];
  isTLorAdmin: boolean;
  currentUserId: string;
  departments?: any[];
  userDepartment?: string;
}

export function CreateRecurringScheduleDialog({
  projectId,
  members,
  isTLorAdmin,
  currentUserId,
  departments = [],
  userDepartment,
}: CreateRecurringScheduleDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const initialParentDeptId = React.useMemo(() => {
    if (!userDepartment) return null
    const found = departments.find((d: any) => d.id === userDepartment)
    return found?.parentDepartmentId || found?.id || userDepartment
  }, [userDepartment, departments])

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(initialParentDeptId)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      assignedToId: currentUserId || "",
      frequency: "MONTHLY",
      nextRunAt: new Date(),
    },
  })

  // 1. Filter ONLY parent departments for the Department selector
  const parentDepartments = React.useMemo(() => {
    return departments
      .filter((d: any) => !d.parentDepartmentId)
      .map((d: any) => {
        const directTemplates = d.taskMasters || []
        let totalTemplates = directTemplates.length

        departments.forEach((sub: any) => {
          if (sub.parentDepartmentId === d.id) {
            totalTemplates += (sub.taskMasters || []).length
          }
        })

        return {
          id: d.id,
          name: d.name,
          totalTemplates,
          taskMasters: directTemplates
        }
      })
  }, [departments])

  // 2. Aggregate available templates across parent and all its sub-departments
  const availableTemplates = React.useMemo(() => {
    if (!selectedDepartmentId) return []

    if (selectedDepartmentId === "ALL") {
      const all: any[] = []
      departments.forEach((d: any) => {
        const parent = d.parentDepartment || departments.find((p: any) => p.id === d.parentDepartmentId)
        const deptLabel = parent ? `${parent.name} › ${d.name}` : d.name
        ;(d.taskMasters || []).forEach((t: any) => {
          all.push({
            ...t,
            departmentName: deptLabel,
            sourceDeptId: d.id,
            isSubDept: !!parent
          })
        })
      })
      return all
    }

    const familyDeptIds = new Set<string>()
    familyDeptIds.add(selectedDepartmentId)
    departments.forEach((d: any) => {
      if (d.parentDepartmentId === selectedDepartmentId || d.id === selectedDepartmentId) {
        familyDeptIds.add(d.id)
      }
    })

    const templates: any[] = []
    departments.forEach((d: any) => {
      if (familyDeptIds.has(d.id)) {
        const isChildSub = d.parentDepartmentId === selectedDepartmentId
        const deptLabel = isChildSub ? `${d.name}` : d.name
        ;(d.taskMasters || []).forEach((t: any) => {
          templates.push({
            ...t,
            departmentName: deptLabel,
            sourceDeptId: d.id,
            isSubDept: isChildSub
          })
        })
      }
    })

    return templates.sort((a, b) => {
      if (!a.isSubDept && b.isSubDept) return -1
      if (a.isSubDept && !b.isSubDept) return 1
      return a.name.localeCompare(b.name)
    })
  }, [selectedDepartmentId, departments])

  // 3. Filter assignable members: includes all members from parent dept AND all sub-depts
  const filteredMembers = React.useMemo(() => {
    let list = members
    if (selectedDepartmentId && selectedDepartmentId !== "ALL") {
      const familyDeptIds = new Set<string>()
      familyDeptIds.add(selectedDepartmentId)
      departments.forEach((d: any) => {
        if (d.parentDepartmentId === selectedDepartmentId || d.id === selectedDepartmentId) {
          familyDeptIds.add(d.id)
        }
      })

      list = members.filter((m: any) => m.departmentId && familyDeptIds.has(m.departmentId))
    }

    if (isTLorAdmin && currentUserId && !list.some((m: any) => m.id === currentUserId)) {
      const currentUser = members.find((m: any) => m.id === currentUserId)
      if (currentUser) {
        list = [currentUser, ...list]
      }
    }

    const uniqueMap = new Map<string, any>()
    list.forEach((m: any) => {
      if (m.id && !uniqueMap.has(m.id)) {
        const dept = departments.find((d: any) => d.id === m.departmentId)
        const isSub = !!dept?.parentDepartmentId
        const deptBadge = dept ? dept.name : ""
        uniqueMap.set(m.id, {
          ...m,
          deptBadge,
          isSubDeptMember: isSub
        })
      }
    })

    return Array.from(uniqueMap.values())
  }, [members, selectedDepartmentId, departments, currentUserId, isTLorAdmin])

  const handleTemplateSelect = (templateId: string) => {
    const template = availableTemplates.find((t: any) => t.id === templateId)

    if (template) {
      form.setValue("name", template.name)
      form.setValue("taskMasterId", template.id)
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    const result = await createRecurringTaskSchedule({
      ...values,
      projectId,
      departmentId: selectedDepartmentId || undefined,
    })

    if (result.success) {
      toast.success("Recurring schedule created successfully")
      setOpen(false)
      form.reset()
      router.refresh()
    } else {
      toast.error(result.error || "Failed to create schedule")
    }
    setIsSubmitting(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
      setSelectedDepartmentId(userDepartment || null)
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs font-semibold rounded-md bg-background border-border/80 hover:bg-muted/40 text-foreground shadow-2xs transition-colors gap-1.5 cursor-pointer"
        >
          <Repeat className="size-3.5 text-primary" />
          <span>Recurring Task</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        aria-describedby={undefined}
        className="sm:max-w-xl md:max-w-2xl w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card"
      >
        {/* ── Modal Header ── */}
        <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Repeat className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                New Recurring Task
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Automate weekly, monthly, or periodic task schedules
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Modal Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {departments.length > 0 && (
            <div className="p-5 bg-muted/15 border-b border-border/70 space-y-3.5">
              <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                <Layers className="size-4 text-purple-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Task Catalog & Quick Templates
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">1. Select Department</Label>
                  <Select onValueChange={setSelectedDepartmentId} value={selectedDepartmentId || undefined}>
                    <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                      <SelectValue placeholder="Identify Dept..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-md border-border/80 max-h-[260px]">
                      <SelectItem value="ALL" className="text-xs font-bold text-muted-foreground">All Departments (All Templates)</SelectItem>
                      {parentDepartments.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="truncate font-semibold max-w-[170px] sm:max-w-[220px]">
                              {t.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                              ({t.totalTemplates} templates)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">2. Task Template</Label>
                  <Select
                    onValueChange={handleTemplateSelect}
                    disabled={!selectedDepartmentId || availableTemplates.length === 0}
                  >
                    <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                      <SelectValue placeholder={availableTemplates.length > 0 ? `Select Template (${availableTemplates.length} available)...` : "No Templates"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-md border-border/80 max-h-[280px]">
                      {availableTemplates.map((t: any) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs" title={t.name}>
                          <div className="flex items-center justify-between gap-2 w-full">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-[220px]">
                                {t.name}
                              </span>
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 border border-border/40">
                                {t.departmentName}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold text-primary shrink-0 tabular-nums">
                              {t.defaultDurationDays ? `${t.defaultDurationDays}d` : "0d"}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form id="create-recurring-form" onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">
                      Task Name <span className="text-rose-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Monthly Salary Disbursement"
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
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">
                      Description & Instructions
                    </FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={(html) => field.onChange(html)}
                        placeholder="Description or recurring instructions..."
                        minHeight="120px"
                        className="max-h-[200px] overflow-y-auto text-xs rounded-md border-border/80"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">
                      Assignee
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!isTLorAdmin}>
                      <FormControl>
                        <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-medium w-full focus:ring-primary/20">
                          <SelectValue placeholder="Select Assignee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-md max-h-[260px] overflow-y-auto border-border/80 shadow-xl">
                        {filteredMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id} className="text-xs">
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span className="truncate font-medium max-w-[150px] sm:max-w-[220px]">{member.name || member.email || member.id}</span>
                              {member.deptBadge && (
                                <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 border", member.isSubDeptMember ? "bg-primary/5 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border/40")}>
                                  {member.deptBadge}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-foreground">
                        Frequency
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20">
                            <SelectValue placeholder="Frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-md border-border/80">
                          <SelectItem value="DAILY" className="text-xs">Daily</SelectItem>
                          <SelectItem value="WEEKLY" className="text-xs">Weekly</SelectItem>
                          <SelectItem value="MONTHLY" className="text-xs">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextRunAt"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5 flex flex-col">
                      <FormLabel className="text-xs font-semibold text-foreground">
                        Start Date
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "h-9 w-full bg-background border-border/80 rounded-md text-xs font-medium px-3 text-left focus:ring-primary/20",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick Date</span>}
                              <CalendarIcon className="ml-auto size-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-md border-border/80 shadow-xl" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
            form="create-recurring-form"
            disabled={isSubmitting}
            className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Creating Schedule...</span>
              </>
            ) : (
              <>
                <Repeat className="size-4" />
                <span>Create Schedule</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
