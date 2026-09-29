"use client";

import { useState } from "react";
import { UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyIncompleteProfiles } from "@/actions/notification";
import { toast } from "sonner";

export function NotifyIncompleteProfilesButton() {
  const [isPending, setIsPending] = useState(false);

  const handleNotify = async () => {
    setIsPending(true);
    try {
      const result = await notifyIncompleteProfiles();
      if (result.success) {
        if (result.count && result.count > 0) {
          toast.success(`Sent profile update reminders to ${result.count} employees.`);
        } else {
          toast.info("All employees have complete profiles.");
        }
      } else {
        toast.error(result.error || "Failed to send notifications.");
      }
    } catch (error) {
      toast.error("An error occurred while sending notifications.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleNotify}
      disabled={isPending}
      title="Remind Incomplete Profiles"
      className="h-8 sm:h-9 px-2.5 sm:px-3.5 text-xs font-semibold border-border/80 rounded-md hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 transition-all duration-200 shrink-0 cursor-pointer"
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin sm:mr-2 text-amber-600" />
      ) : (
        <UserCheck className="size-3.5 sm:mr-2 text-amber-600" />
      )}
      <span className="hidden sm:inline">Remind Incomplete Profiles</span>
    </Button>
  );
}
