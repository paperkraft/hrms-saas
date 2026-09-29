"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { applyForOvertime } from "@/actions/payroll/overtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Timer, Send, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  hours: z.number().min(0.5, "Minimum 0.5 hours required").max(24, "Invalid hours"),
  reason: z.string().min(5, "Reason is required (min 5 chars)"),
});

type Values = z.infer<typeof schema>;

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-9 bg-muted/20 border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 focus:border-primary w-full";

export function OvertimeRequestForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: "",
      hours: 1,
      reason: "",
    },
  });

  const onSubmit = async (data: Values) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const result = await applyForOvertime(data);
      if (result.success) {
        toast.success("Overtime request submitted successfully!");
        reset();
        onSuccess?.();
      } else {
        setServerError(result.error || "Failed to submit request");
        toast.error(result.error || "Failed to submit request");
      }
    } catch (error) {
      setServerError("Something went wrong");
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="date" className={labelClass}>
            Date
          </Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
            className={inputClass}
          />
          {errors.date && (
            <p className="text-[10px] text-rose-500 font-bold mt-1">
              {errors.date.message}
            </p>
          )}
        </div>

        {/* Hours */}
        <div className="space-y-1.5">
          <Label htmlFor="hours" className={labelClass}>
            Hours Worked
          </Label>
          <div className="relative group/input">
            <Input
              id="hours"
              type="number"
              step="0.5"
              {...register("hours", { valueAsNumber: true })}
              className={cn(inputClass, "pl-8")}
            />
            <Timer className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
          </div>
          {errors.hours && (
            <p className="text-[10px] text-rose-500 font-bold mt-1">
              {errors.hours.message}
            </p>
          )}
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-1.5 pt-2 border-t border-border/60">
        <Label htmlFor="reason" className={labelClass}>
          Task Summary / Reason
        </Label>
        <div className="relative group/input">
          <Input
            id="reason"
            type="text"
            placeholder="e.g. Completed pending release modules and testing"
            {...register("reason")}
            className={cn(inputClass, "pl-8")}
          />
          <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
        </div>
        <p className="text-[9px] text-muted-foreground font-medium px-0.5">
          Briefly describe what tasks required overtime
        </p>
        {errors.reason && (
          <p className="text-[10px] text-rose-500 font-bold mt-1">
            {errors.reason.message}
          </p>
        )}
      </div>

      {/* Errors */}
      {serverError && (
        <div className="bg-rose-500/5 text-rose-600 text-xs p-3 rounded-md flex items-center gap-2 border border-rose-500/20">
          <AlertCircle className="size-4 shrink-0" />
          <span className="font-semibold">{serverError}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-9 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
      >
        {isSubmitting ? (
          "Submitting..."
        ) : (
          <>
            <Send className="size-3.5 mr-1.5" /> Submit Overtime Request
          </>
        )}
      </Button>
    </form>
  );
}
