"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle } from "lucide-react"
import { permanentlyDeleteUser } from "@/actions/user"
import { toast } from "sonner"

interface DeleteUserDialogProps {
  user: {
    id: string
    name: string | null
    email: string
    designation?: string | null
    roleDefinition?: { name: string } | null
    role?: string | null
  }
}

export function DeleteUserDialog({ user }: DeleteUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await permanentlyDeleteUser(user.id)
      if (!res.success) {
        toast.error(res.error || "Failed to permanently delete user")
      } else {
        toast.success(`User ${user.name || user.email} permanently deleted`)
        setOpen(false)
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-sm transition-all"
          title="Permanently Delete User"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2 text-base font-bold">
            <Trash2 className="size-5 shrink-0" />
            Permanently Delete Employee
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            You are about to permanently remove this user account from the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 bg-muted/40 rounded border border-border space-y-1">
            <div className="font-bold text-foreground">{user.name || "Unnamed User"}</div>
            <div className="text-muted-foreground font-mono text-[11px]">{user.email}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider pt-0.5">
              Role: {user.roleDefinition?.name || user.role || "Employee"} • {user.designation || "No designation"}
            </div>
          </div>

          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-700 dark:text-rose-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Warning: This action cannot be undone</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              All personal attendance records, leave balances, grievances, and system credentials for this user will be permanently deleted from the database. Any tasks or projects associated with this user will be unlinked safely.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs font-bold uppercase tracking-wider"
          >
            {isDeleting ? "Deleting..." : "Permanently Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
