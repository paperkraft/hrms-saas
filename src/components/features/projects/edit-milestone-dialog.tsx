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
import { CalendarIcon, Loader2 } from "lucide-react"
import { updateMilestone } from "@/actions/projects/milestones"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  dueDate: z.date().optional(),
})

interface Milestone {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
}

interface EditMilestoneDialogProps {
  milestone: Milestone | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditMilestoneDialog({ milestone, open, onOpenChange }: EditMilestoneDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  })

  useEffect(() => {
    if (milestone) {
      form.reset({
        title: milestone.title,
        description: milestone.description || "",
        dueDate: milestone.dueDate ? new Date(milestone.dueDate) : undefined,
      })
    }
  }, [milestone, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!milestone) return
    
    setIsSubmitting(true)
    const result = await updateMilestone(milestone.id, values)
    if (result.success) {
      toast.success("Milestone updated successfully")
      onOpenChange(false)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to update milestone")
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 rounded-sm border border-border shadow-none overflow-hidden max-w-md bg-white">
        <DialogHeader className="px-5 py-4 border-b border-border/40">
          <DialogTitle className="text-sm font-bold tracking-tight">Edit Milestone</DialogTitle>
          <p className="text-[10px] text-muted-foreground/80 font-bold tracking-widest uppercase">
            Modify project target details
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Milestone Title
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Phase 1 Completion" className="h-9 w-full bg-muted/5 border-border rounded-sm text-xs font-medium px-3 focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all outline-none" {...field} />
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
                    <Textarea placeholder="Details about this target..." className="min-h-[80px] w-full bg-muted/5 border-border rounded-sm text-xs font-medium p-3 focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all outline-none resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    Target Date
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "h-9 w-full bg-muted/5 border-border rounded-sm text-xs font-medium px-3 text-left",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-30" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-sm overflow-hidden border-border shadow-lg" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        captionLayout="dropdown"
                        fromYear={1990}
                        toYear={new Date().getFullYear() + 10}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-9 text-[10px] font-bold uppercase tracking-widest rounded-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-9 bg-primary hover:bg-primary/90 text-[10px] font-bold uppercase tracking-widest rounded-sm text-white"
              >
                {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : "Update Milestone"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
