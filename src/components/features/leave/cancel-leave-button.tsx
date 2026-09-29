"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { XCircle, Loader2 } from "lucide-react";
import { cancelApprovedLeave } from "@/actions/leave/request";
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

interface CancelLeaveButtonProps {
  requestId: string;
  employeeName: string;
}

export function CancelLeaveButton({ requestId, employeeName }: CancelLeaveButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelApprovedLeave(requestId, "Cancelled to prevent double-counting as employee present.");
      if (result && 'error' in result) {
        toast.error("Cancellation Failed", {
          description: result.error as string,
        });
      } else {
        toast.success("Leave Cancelled", {
          description: `Successfully reverted balance for ${employeeName}.`,
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the approved leave for **{employeeName}** and revert their leave balance. 
            Use this only if the employee actually worked on these dates to prevent double-counting.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Leave</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancel} className="bg-destructive hover:bg-destructive/90">
            Cancel Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
