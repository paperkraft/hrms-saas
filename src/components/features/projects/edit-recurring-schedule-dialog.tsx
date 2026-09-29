"use client"

import { useState, useTransition } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Edit2 } from "lucide-react"
import { updateRecurringTaskSchedule } from "@/actions/projects/recurring"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

const formSchema = z.object({
  name: z.string().min(2, "Task name is required"),
  description: z.string().optional(),
  assignedToId: z.string().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  nextRunAt: z.date({ required_error: "Start date is required" }),
})

interface EditRecurringScheduleDialogProps {
  schedule: any;
  projectId: string;
  members: { id: string; name: string | null; departmentId?: string | null }[];
  isTLorAdmin: boolean;
}

export function EditRecurringScheduleDialog({
  schedule,
  projectId,
  members,
  isTLorAdmin,
}: EditRecurringScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: schedule.name || "",
      description: schedule.description || "",
      assignedToId: schedule.assignedToId || "",
      frequency: schedule.frequency || "WEEKLY",
      nextRunAt: schedule.nextRunAt ? new Date(schedule.nextRunAt) : new Date(),
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    const result = await updateRecurringTaskSchedule(schedule.id, {
      ...values,
    })

    if (result.success) {
      toast.success("Recurring schedule updated successfully")
      setOpen(false)
    } else {
      toast.error(result.error || "Failed to update schedule")
    }
    setIsSubmitting(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset({
        name: schedule.name || "",
        description: schedule.description || "",
        assignedToId: schedule.assignedToId || "",
        frequency: schedule.frequency || "WEEKLY",
        nextRunAt: schedule.nextRunAt ? new Date(schedule.nextRunAt) : new Date(),
      })
    }
    setOpen(newOpen)
  }

  if (!isTLorAdmin) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="p-1.5 rounded-sm bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors"
          title="Edit Schedule"
        >
          <Edit2 className="size-3.5" />
        </button>
      </DialogTrigger>

      <DialogContent className="gap-0 p-0 rounded-sm border border-border shadow-lg overflow-hidden sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 py-4 border-b border-border/40 bg-muted/10 shrink-0">
          <DialogTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
            <Edit2 className="size-4 text-primary" />
            Edit Recurring Task
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground/80 font-bold tracking-widest uppercase">
            Update automation settings
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="edit-recurring-form" onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4 flex-1 overflow-y-auto">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Task Name
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Monthly Salary Disbursement" className="h-8 rounded-sm text-xs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Description
                  </FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value || ""}
                      onChange={(html) => field.onChange(html)}
                      placeholder="Description or instructions..."
                      minHeight="120px"
                      className="max-h-[200px] overflow-y-auto text-xs"
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
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Assignee
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isTLorAdmin}>
                    <FormControl>
                      <SelectTrigger className="h-8 rounded-sm text-xs w-full min-w-0">
                        <SelectValue placeholder="Select Assignee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-sm max-h-[220px] overflow-y-auto border-border/40 shadow-lg">
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id} className="text-xs">
                          <span className="truncate max-w-[420px]">{member.name || member.id}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                      Frequency
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-8 rounded-sm text-xs">
                          <SelectValue placeholder="Frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-sm">
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
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                      Start Date
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "h-8 rounded-sm text-xs px-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick Date</span>}
                            <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-sm" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
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

        <div className="px-5 py-3 border-t border-border/40 bg-card dark:bg-muted/20 shrink-0 flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-8 text-xs font-bold uppercase rounded-sm">
            Cancel
          </Button>
          <Button type="submit" form="edit-recurring-form" disabled={isSubmitting} className="flex-1 h-8 bg-primary hover:bg-primary/90 text-xs font-bold uppercase rounded-sm">
            {isSubmitting ? "Updating..." : "Update Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
