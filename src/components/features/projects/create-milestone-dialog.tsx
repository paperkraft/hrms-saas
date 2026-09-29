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
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Button,
  Textarea,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui"
import { Plus, CalendarIcon, Loader2, Target } from "lucide-react"
import { createMilestone } from "@/actions/projects/milestones"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  dueDate: z.date().optional(),
})

export function CreateMilestoneDialog({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    const result = await createMilestone(projectId, values)
    if (result.success) {
      toast.success("Milestone created successfully")
      setOpen(false)
      form.reset()
      router.refresh()
    } else {
      toast.error(result.error || "Failed to create milestone")
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs font-semibold rounded-md bg-background border-border/80 hover:bg-muted/40 text-foreground shadow-2xs transition-colors gap-1.5 cursor-pointer"
        >
          <Target className="size-3.5 text-primary" />
          <span>Add Milestone</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-md border border-border/80 shadow-2xl bg-card">
        {/* ── Modal Header ── */}
        <DialogHeader className="px-6 py-5 border-b shrink-0 bg-background/50 border-border/60">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Target className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Add Project Milestone
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Define key deliverables, target dates, and phase objectives
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Modal Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <Form {...form}>
            <form id="create-milestone-form" onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground">
                      Milestone Title <span className="text-rose-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Phase 1 Completion & Review"
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
                      Description & Scope
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Details about this target, objectives, and deliverables..."
                        className="min-h-[90px] bg-background border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 p-3 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="space-y-1.5 flex flex-col">
                    <FormLabel className="text-xs font-semibold text-foreground">
                      Target Completion Date
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
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick target completion date</span>
                            )}
                            <CalendarIcon className="ml-auto size-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-md overflow-hidden border-border/80 shadow-xl" align="start">
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
            form="create-milestone-form"
            disabled={isSubmitting}
            className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Saving Milestone...</span>
              </>
            ) : (
              <>
                <Target className="size-4" />
                <span>Save Milestone</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
