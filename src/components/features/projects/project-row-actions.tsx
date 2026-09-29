"use client"

import { useState } from "react"
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui"
import { MoreHorizontal, Trash2, Edit, CheckCircle2, RotateCcw, Share2, UserPlus } from "lucide-react"
import { deleteProject, updateProject } from "@/actions/projects/core"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { EditProjectDialog } from "./edit-project-dialog"
import { ProjectShareModal } from "./project-share-modal"
import { cn } from "@/lib/utils"

export function ProjectRowActions({
  project,
  isAdmin = false,
}: {
  project: any;
  isAdmin?: boolean;
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isForcedDelete, setIsForcedDelete] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showCompleteAlert, setShowCompleteAlert] = useState(false)
  const [showReactivateAlert, setShowReactivateAlert] = useState(false)

  async function handleComplete() {
    setLoading(true)
    const result = await updateProject(project.id, { status: "COMPLETED" })
    setLoading(false)
    
    if (result.success) {
      toast.success("Project marked as completed")
      setShowCompleteAlert(false)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to mark project as completed")
    }
  }

  async function handleReactivate() {
    setLoading(true)
    const result = await updateProject(project.id, { status: "ACTIVE" })
    setLoading(false)
    
    if (result.success) {
      toast.success("Project re-activated successfully")
      setShowReactivateAlert(false)
      router.refresh()
    } else {
      toast.error(result.error || "Failed to re-activate project")
    }
  }

  async function handleDelete(force: boolean = false) {
    setLoading(true)
    const result = await deleteProject(project.id, force)
    setLoading(false)
    
    if (result.success) {
      toast.success("Project deleted successfully")
      setShowDeleteAlert(false)
      router.refresh()
    } else {
      if (result.requiresForce) {
        setErrorMessage(result.error)
        setIsForcedDelete(true)
      } else {
        toast.error(result.error || "Failed to delete project")
      }
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[170px]">
          {isAdmin && (
            <DropdownMenuItem 
              onSelect={() => {
                setMenuOpen(false)
                setShowShareModal(true)
              }}
              className="text-primary font-medium"
            >
              <UserPlus className="mr-2 h-4 w-4 text-primary" />
              Share Project
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onSelect={() => {
              setMenuOpen(false)
              setShowEditDialog(true)
            }}
          >
            <Edit className="mr-2 h-4 w-4 text-blue-500" />
            Edit Project
          </DropdownMenuItem>
          {project.status !== "COMPLETED" && (
            <DropdownMenuItem 
              className="text-emerald-600"
              onSelect={() => {
                setMenuOpen(false)
                setShowCompleteAlert(true)
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark Complete
            </DropdownMenuItem>
          )}
          {project.status === "COMPLETED" && (
            <DropdownMenuItem 
              className="text-amber-600"
              onSelect={() => {
                setMenuOpen(false)
                setShowReactivateAlert(true)
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Re-activate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            className="text-rose-600"
            onSelect={() => {
              setErrorMessage(null)
              setIsForcedDelete(false)
              setShowDeleteAlert(true)
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        project={project}
      />

      <EditProjectDialog 
        project={project} 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog} 
      />

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">
              {isForcedDelete ? "Force Delete Project?" : "Are you absolutely sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {errorMessage || `This will permanently delete the project "${project.name}" and all its associated tasks. This action cannot be undone.`}
              {isForcedDelete && (
                <span className="mt-2 block p-2 bg-rose-50 border border-rose-100 rounded-sm text-rose-700 text-[9px] font-bold uppercase tracking-widest">
                  Warning: Completed tasks and mission data will be removed.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => {
                setShowDeleteAlert(false)
                setIsForcedDelete(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                handleDelete(isForcedDelete)
              }}
              disabled={loading}
            >
              {loading ? "Processing..." : isForcedDelete ? "Force Delete" : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCompleteAlert} onOpenChange={setShowCompleteAlert}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">
              Mark Project as Completed?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will mark the project "{project.name}" as completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setShowCompleteAlert(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                handleComplete()
              }}
              disabled={loading}
            >
              {loading ? "Processing..." : "Mark Completed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReactivateAlert} onOpenChange={setShowReactivateAlert}>
        <AlertDialogContent className="rounded-sm border-border shadow-lg sm:max-w-[420px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold tracking-tight">
              Re-activate Project?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will change the project "{project.name}" back to ACTIVE status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest"
              onClick={() => setShowReactivateAlert(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 rounded-sm bg-amber-600 hover:bg-amber-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
              onClick={(e) => {
                e.preventDefault()
                handleReactivate()
              }}
              disabled={loading}
            >
              {loading ? "Processing..." : "Re-activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
