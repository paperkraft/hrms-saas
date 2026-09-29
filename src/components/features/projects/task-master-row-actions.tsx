"use client"

import { useState } from "react"
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui"
import { Trash2, AlertTriangle, RotateCw } from "lucide-react"
import { deleteTaskMaster } from "@/actions/task-master"
import { CreateTaskMasterDialog } from "./create-task-master-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface TaskMasterRowActionsProps {
  taskMaster: any
  departments: any[]
}

export function TaskMasterRowActions({ taskMaster, departments }: TaskMasterRowActionsProps) {
  const router = useRouter()
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const result = await deleteTaskMaster(taskMaster.id)
      if (result.success) {
        toast.success("Task template removed from catalog")
        setShowDeleteAlert(false)
        router.refresh()
      } else {
        toast.error(result.error || "Failed to delete task template")
      }
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <CreateTaskMasterDialog departments={departments} taskMaster={taskMaster} />
        <Button 
          variant="ghost" 
          size="icon" 
          className="size-8 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          onClick={() => setShowDeleteAlert(true)}
          title="Delete task template"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card sm:max-w-md">
          <div className="p-5 border-b border-border/80 bg-destructive/5">
            <AlertDialogHeader className="gap-1">
              <div className="flex items-center gap-2.5 text-destructive mb-0.5">
                <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="size-4.5 text-destructive" />
                </div>
                <AlertDialogTitle className="text-base font-bold text-foreground">
                  Delete Task Template
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Permanently delete this task template from the standardized organization catalog.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <div className="p-5 space-y-2 text-xs">
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/40 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Task Name:</span>
                <span className="font-bold text-foreground">{taskMaster.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Activity:</span>
                <span className="font-medium text-foreground">{taskMaster.activity || "General"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-medium text-foreground">{taskMaster.department?.name || "Global"}</span>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="p-4 sm:px-5 sm:py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-end gap-2.5">
            <AlertDialogCancel 
              className="h-9 px-4 text-xs font-semibold rounded-md border-border/80"
              onClick={() => setShowDeleteAlert(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 px-4 text-xs font-semibold gap-2 cursor-pointer shadow-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={loading}
            >
              {loading ? <RotateCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              <span>Delete Template</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
