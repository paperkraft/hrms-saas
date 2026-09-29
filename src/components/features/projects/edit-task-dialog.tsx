"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui"
import {
  CalendarIcon,
  ListTodo,
  FileText,
  Users,
  Calendar as CalendarLucide,
  Save,
  Loader2
} from "lucide-react"
import { updateTask } from "@/actions/projects/tasks"
import { toast } from "sonner"
import { format, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

const formSchema = z.object({
  name: z.string().min(2, "Task name is required"),
  description: z.string().optional(),
  assignedToId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  plannedStart: z.date().optional().nullable(),
  plannedEnd: z.date().optional().nullable(),
  plannedDuration: z.coerce.number().min(0, "Duration cannot be negative").optional().nullable(),
  activity: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  reviewerId: z.string().optional().nullable(),
})

export function EditTaskDialog({
  task,
  isTLorAdmin,
  members = [],
  allMembers = [],
  open,
  onOpenChange,
  isExternal,
}: {
  task: any;
  isTLorAdmin: boolean;
  members?: any[];
  allMembers?: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isExternal?: boolean;
}) {
  const canAssignOthers = isExternal ? ((members || []).length > 1) : isTLorAdmin;
  const crossDeptReviewers = useMemo(() => {
    const listToUse = allMembers && allMembers.length > 0 ? allMembers : (members || []);
    // Filter out the assignee so they cannot review their own task
    const reviewers = listToUse.filter((m: any) => 
      (m.role === "ADMIN" || m.ledDepartment != null) && m.id !== task?.assignedToId
    );
    
    // Make sure we include current reviewer if they aren't in the list
    if (task?.reviewerId && !reviewers.find((m: any) => m.id === task.reviewerId)) {
      const currentReviewer = listToUse.find((m: any) => m.id === task.reviewerId);
      if (currentReviewer && currentReviewer.id !== task?.assignedToId) reviewers.push(currentReviewer);
    }
    
    return reviewers;
  }, [allMembers, members, task]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: task?.name || "",
      description: task?.description || "",
      assignedToId: task?.assignedToId || "",
      priority: task?.priority || "MEDIUM",
      plannedStart: task?.plannedStart ? new Date(task.plannedStart) : undefined,
      plannedEnd: task?.plannedEnd ? new Date(task.plannedEnd) : undefined,
      plannedDuration: task?.plannedDuration || 0,
      activity: task?.activity || "",
      departmentId: task?.departmentId || "",
      reviewerId: task?.reviewerId || "DEFAULT",
    },
  })

  useEffect(() => {
    if (open && task) {
      form.reset({
        name: task.name || "",
        description: task.description || "",
        assignedToId: task.assignedToId || "",
        priority: task.priority || "MEDIUM",
        plannedStart: task.plannedStart ? new Date(task.plannedStart) : undefined,
        plannedEnd: task.plannedEnd ? new Date(task.plannedEnd) : undefined,
        plannedDuration: task.plannedDuration || 0,
        activity: task.activity || "",
        departmentId: task.departmentId || "",
        reviewerId: task.reviewerId || "DEFAULT",
      })
    }
  }, [open, task, form])

  const plannedStart = form.watch("plannedStart")
  const plannedDuration = form.watch("plannedDuration")

  useEffect(() => {
    if (plannedStart && plannedDuration) {
      form.setValue("plannedEnd", addDays(new Date(plannedStart), Number(plannedDuration)))
    }
  }, [plannedStart, plannedDuration, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const dataToSubmit = { ...values };
    if (dataToSubmit.reviewerId === "DEFAULT") {
      dataToSubmit.reviewerId = null;
    }
    const result = await updateTask(task.id, dataToSubmit)
    if (result.success) {
      toast.success("Task updated successfully")
      onOpenChange(false)
    } else {
      toast.error(result.error || "Failed to update task")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        onInteractOutside={(e) => e.preventDefault()}
        aria-describedby={undefined}
        className="sm:max-w-2xl lg:max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card"
      >
        {/* ── Modal Header ── */}
        <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <ListTodo className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Edit Task: {task?.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Modify task requirements, assignees, priorities, and milestone timelines
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable Form Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <Form {...form}>
            <form id="edit-task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* SECTION 1: Identity & Scope */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <FileText className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Task Identity & Scope
                  </h3>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-foreground">
                        Task Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="What needs to be done?"
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
                        Task Description & Requirements
                      </FormLabel>
                      <FormControl>
                        <RichTextEditor 
                          placeholder="Provide comprehensive task instructions, requirements, and deliverables..." 
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

              {/* SECTION 2: Assignments & Priority */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Task Assignment & Priority
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="assignedToId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Assign To
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canAssignOthers}>
                          <FormControl>
                            <SelectTrigger className={cn("h-9 bg-background border-border/80 rounded-md text-xs font-semibold", !canAssignOthers && "opacity-60 cursor-not-allowed pointer-events-none")}>
                              <SelectValue placeholder={canAssignOthers ? "Select member" : "Self (Default)"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-md border-border/80 max-h-[260px]">
                            {(members || []).map((member: any, index: number) => (
                              <SelectItem key={`${member.id}-${index}`} value={member.id} className="text-xs">
                                {member.name || member.id}
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
                    name="reviewerId"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Reviewer (Cross-Dept)
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "DEFAULT"}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-semibold">
                              <SelectValue placeholder="Select Reviewer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-md border-border/80">
                            <SelectItem value="DEFAULT" className="text-xs italic text-muted-foreground">Default (TL/Admin)</SelectItem>
                            {crossDeptReviewers.map((member: any, index: number) => (
                              <SelectItem key={`rev-${member.id}-${index}`} value={member.id} className="text-xs">
                                <span className="truncate max-w-[150px] sm:max-w-[250px]">{member.name || member.id}</span>
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
                    name="priority"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Priority Level
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 bg-background border-border/80 rounded-md text-xs font-bold">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-md border-border/80">
                            <SelectItem value="LOW" className="text-emerald-600 font-bold text-xs">Low Priority</SelectItem>
                            <SelectItem value="MEDIUM" className="text-amber-600 font-bold text-xs">Medium Priority</SelectItem>
                            <SelectItem value="HIGH" className="text-orange-600 font-bold text-xs">High Priority</SelectItem>
                            <SelectItem value="URGENT" className="text-rose-600 font-bold text-xs">Urgent Priority</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* SECTION 3: Schedule & Planning */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <CalendarLucide className="size-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Timeline & Schedule Planning
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="plannedStart"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 flex flex-col">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Planned Start Date
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "h-9 w-full bg-background border-border/80 rounded-md text-xs font-medium px-3 focus:ring-primary/20 shadow-none text-left cursor-pointer",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick Start Date</span>
                                )}
                                <CalendarIcon className="ml-auto size-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-md overflow-hidden border-border/80 shadow-xl" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plannedEnd"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5 flex flex-col">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Planned End Date
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "h-9 w-full bg-background border-border/80 rounded-md text-xs font-medium px-3 focus:ring-primary/20 shadow-none text-left cursor-pointer",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick End Date</span>
                                )}
                                <CalendarIcon className="ml-auto size-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-md overflow-hidden border-border/80 shadow-xl" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < (form.getValues("plannedStart") || new Date())
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plannedDuration"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Planned Duration (Days)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
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
                    name="activity"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs font-semibold text-foreground">
                          Activity Category
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Development, Design, Review"
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
            </form>
          </Form>
        </div>

        {/* ── Modal Pinned Footer ── */}
        <div className="px-6 py-4 border-t shrink-0 bg-background/50 border-border/60 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-xs font-semibold rounded-md border-border/80 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-task-form"
            disabled={form.formState.isSubmitting}
            className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
          >
            {form.formState.isSubmitting ? (
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
