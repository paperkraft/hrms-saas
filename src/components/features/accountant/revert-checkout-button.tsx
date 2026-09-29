"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Loader2 } from "lucide-react";
import { revertPunchOutAction } from "@/actions/attendance";
import { toast } from "sonner";
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
} from "@/components/ui/alert-dialog";

interface RevertCheckoutButtonProps {
  logId: string;
  userName: string;
}

export function RevertCheckoutButton({ logId, userName }: RevertCheckoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRevert = () => {
    startTransition(async () => {
      const res = await revertPunchOutAction(logId);
      if (res.success) {
        toast.success("Check-out reverted successfully", {
          description: `${userName} is now marked as currently active.`,
        });
      } else {
        toast.error("Revert Failed", {
          description: res.error || "Failed to revert check-out.",
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="h-7 px-2 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/20 rounded-sm transition-all"
        >
          {isPending ? (
            <Loader2 className="size-3 mr-1 animate-spin" />
          ) : (
            <Clock className="size-3 mr-1" />
          )}
          Undo Checkout
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revert Check-out?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to revert the check-out for **{userName}**? 
            This will restore their session to active status and remove the exit time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep as is</AlertDialogCancel>
          <AlertDialogAction onClick={handleRevert} className="bg-rose-500 hover:bg-rose-600 text-white border-none">
            Undo Checkout
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
