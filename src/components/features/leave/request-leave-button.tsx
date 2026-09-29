"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LeaveApplicationForm } from "@/components/features/leave/leave-application-form";
import { CalendarRange, X } from "lucide-react";

export function RequestLeaveButton() {
  const [open, setDialogOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer">
          <CalendarRange className="size-3.5 mr-1.5" /> Request Leave
        </Button>
      </DialogTrigger>
      <DialogContent 
        onInteractOutside={(e) => e.preventDefault()}
        className="p-0 rounded-md border border-border/80 shadow-2xl overflow-hidden sm:max-w-xl group"
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/70 bg-muted/20 shrink-0">
            <DialogTitle className="sr-only">Apply for Leave</DialogTitle>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <CalendarRange className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Apply for Leave</h2>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Submit a casual, sick, or short leave application</p>
                </div>
              </div>
            </DialogHeader>
            <DialogDescription className="sr-only">Fill in the details below to request time off.</DialogDescription>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-5">
            <LeaveApplicationForm onSuccess={() => setDialogOpen(false)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
