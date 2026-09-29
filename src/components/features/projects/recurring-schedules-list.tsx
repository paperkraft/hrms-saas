"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Repeat, Play, Trash2 } from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Spinner,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui"
import { triggerRecurringTasksManually, deleteRecurringTaskSchedule } from "@/actions/projects/recurring"
import { toast } from "sonner"
import { EditRecurringScheduleDialog } from "./edit-recurring-schedule-dialog"
import { usePagination } from "@/hooks/use-pagination"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { stripHtml } from "@/lib/utils"

export function RecurringSchedulesList({
  schedules,
  isAdmin,
  members,
  currentUserId,
  projectId
}: {
  schedules: any[];
  isAdmin?: boolean;
  members?: any[];
  currentUserId?: string;
  projectId?: string;
}) {
  const [isTriggering, setIsTriggering] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleTrigger = async () => {
    setIsTriggering(true)
    const result = await triggerRecurringTasksManually()
    if (result.success) {
      toast.success(`Engine triggered successfully! Processed ${result.data} tasks.`)
    } else {
      toast.error(result.error || "Failed to trigger engine")
    }
    setIsTriggering(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const result = await deleteRecurringTaskSchedule(id)
    if (result.success) {
      toast.success("Recurring schedule deleted")
    } else {
      toast.error(result.error || "Failed to delete schedule")
    }
    setDeletingId(null)
  }

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedSchedules,
    totalItems,
    itemsPerPage
  } = usePagination(schedules || [], 10)

  if (!schedules || schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-sm border-dashed bg-muted/5">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
          <Repeat className="size-6" />
        </div>
        <h3 className="text-sm font-bold">No Recurring Tasks</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          You haven't set up any recurring tasks for this project yet. Use the "Recurring Task" button above to automate your tasks.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button 
            onClick={handleTrigger} 
            disabled={isTriggering}
            size="sm" 
            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold uppercase tracking-widest gap-1.5"
          >
            {isTriggering ? <Spinner className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Trigger Engine
          </Button>
        </div>
      )}

      <div className="bg-white dark:bg-card/50 rounded-sm border flex flex-col min-h-[350px]">
        <div className="flex-1 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-4">Task Name & Description</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Assigned To</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Frequency</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Next Run</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Last Run</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSchedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  className="group hover:bg-muted/10 border-b border-border/30 last:border-0 transition-colors"
                >
                  <TableCell className="max-w-[280px] pl-4">
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-[11px] font-bold text-foreground truncate" title={schedule.name}>
                        {schedule.name}
                      </span>
                      {schedule.description && (
                        <span className="text-[10px] text-muted-foreground truncate" title={stripHtml(schedule.description)}>
                          {stripHtml(schedule.description)}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6 border shrink-0">
                        {schedule.assignedTo?.avatarUrl && (
                          <AvatarImage src={schedule.assignedTo.avatarUrl} alt={schedule.assignedTo.name || "U"} className="object-cover" />
                        )}
                        <AvatarFallback className="text-[8px] font-black uppercase bg-muted">
                          {schedule.assignedTo?.name ? schedule.assignedTo.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("") : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] font-medium text-foreground/70 truncate max-w-[140px]" title={schedule.assignedTo?.name || "Unassigned"}>
                        {schedule.assignedTo ? schedule.assignedTo.name : "Unassigned"}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className="rounded-full px-2 py-0 h-5 text-[9px] font-bold uppercase bg-primary/5 text-primary border-primary/20 shrink-0"
                    >
                      {schedule.frequency}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-[10px] tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {schedule.nextRunAt ? format(new Date(schedule.nextRunAt), "dd-MM-yyyy") : "-"}
                  </TableCell>

                  <TableCell className="text-[10px] tabular-nums text-muted-foreground">
                    {schedule.lastRunAt ? format(new Date(schedule.lastRunAt), "dd-MM-yyyy") : "-"}
                  </TableCell>

                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && (
                        <>
                          <EditRecurringScheduleDialog
                            schedule={schedule}
                            projectId={projectId!}
                            members={members!}
                            isTLorAdmin={true}
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button 
                                disabled={deletingId === schedule.id}
                                className="p-1.5 rounded-sm bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 transition-colors disabled:opacity-50"
                                title="Delete Schedule"
                              >
                                {deletingId === schedule.id ? <Spinner className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the recurring schedule "{schedule.name}". 
                                  Tasks that have already been generated will not be affected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="h-8 text-xs font-bold uppercase rounded-sm">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(schedule.id)}
                                  className="h-8 bg-rose-600 hover:bg-rose-700 text-xs font-bold uppercase rounded-sm"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {totalPages > 1 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            showOnlyNavigationOnMobile={true}
          />
        )}
      </div>
    </div>
  )
}
