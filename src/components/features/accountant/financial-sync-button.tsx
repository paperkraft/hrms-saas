"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { triggerFinancialSync } from "@/actions/financials";
import { toast } from "sonner";

export function FinancialSyncButton() {
  const [isPending, startTransition] = useTransition();

  const handleTrigger = () => {
    startTransition(async () => {
      const result = await triggerFinancialSync();
      if (result.success) {
        toast.success("Processing Complete", {
          description: result.message,
        });
      } else if (result.error) {
        toast.error("Process Failed", {
          description: result.error,
        });
      }
    });
  };

  return (
    <Button
      onClick={handleTrigger}
      disabled={isPending}
      variant="outline"
      className="h-9 px-4 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary text-[11px] font-bold uppercase tracking-widest rounded-sm transition-colors"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Financial Sync
        </>
      )}
    </Button>
  );
}
