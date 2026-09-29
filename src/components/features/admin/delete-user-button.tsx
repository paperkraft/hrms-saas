"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { deleteUser } from "@/actions/user"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DeleteUserButton({ id, name }: { id: string, name: string | null }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteUser(id)
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-sm transition-all"
          disabled={isPending}
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-sm border-border shadow-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-bold tracking-tight">Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            This will permanently delete the account for **{name || "this employee"}**.
            This action cannot be undone and will remove all associated records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-8 rounded-sm text-[10px] font-black uppercase tracking-widest">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="h-8 rounded-sm bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white border-0"
          >
            Delete Employee
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
