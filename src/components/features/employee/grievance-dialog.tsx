"use client";

import { useState } from "react";
import { GrievanceForm } from "./grievance-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";

export function GrievanceDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-3.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer w-full sm:w-auto">
          <AlertCircle className="size-3.5 mr-1.5" /> Attendance Adjustment
        </Button>
      </DialogTrigger>
      <DialogContent 
        onInteractOutside={(e) => e.preventDefault()}
        className="p-0 rounded-md border border-border/80 shadow-2xl overflow-hidden sm:max-w-md group"
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/70 bg-muted/20 shrink-0">
            <DialogTitle className="sr-only">Attendance Adjustment</DialogTitle>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Attendance Adjustment</h2>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Missed punch correction request for manager approval</p>
                </div>
              </div>
            </DialogHeader>
            <DialogDescription className="sr-only">
              Forgot to punch in or out? Submit a request to your manager to correct your attendance.
            </DialogDescription>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-5">
            <GrievanceForm onComplete={() => setOpen(false)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
