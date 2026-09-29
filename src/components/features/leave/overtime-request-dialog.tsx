"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Timer } from "lucide-react";
import { OvertimeRequestForm } from "./overtime-request-form";
import { useState } from "react";

export function OvertimeRequestDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-9 px-3.5 bg-background hover:bg-muted text-foreground border border-border/80 text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer">
          <Timer className="size-3.5 mr-1.5 text-primary" /> Request Overtime
        </Button>
      </DialogTrigger>
      <DialogContent 
        onInteractOutside={(e) => e.preventDefault()}
        className="p-0 rounded-md border border-border/80 shadow-2xl overflow-hidden sm:max-w-xl group"
      >
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/70 bg-muted/20 shrink-0">
            <DialogTitle className="sr-only">Apply for Overtime</DialogTitle>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <Timer className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Apply for Overtime</h2>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Log extra hours worked for review & payroll calculation</p>
                </div>
              </div>
            </DialogHeader>
            <DialogDescription className="sr-only">
              Apply for overtime hours if you worked extra hours.
            </DialogDescription>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-5">
            <OvertimeRequestForm onSuccess={() => setOpen(false)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
