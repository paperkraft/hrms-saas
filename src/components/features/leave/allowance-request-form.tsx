"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { applyForAllowance } from "@/actions/payroll/allowance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Send, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const schema = z.object({
  fromDate: z.string().min(1, "From date is required"),
  toDate: z.string().min(1, "To date is required"),
  location: z.string().min(3, "Location is required (min 3 chars)"),
});

type Values = z.infer<typeof schema>;

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-9 bg-muted/20 border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 focus:border-primary w-full";

export function AllowanceRequestForm({ onSuccess }: { onSuccess?: () => void }) {
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
      fromDate: "",
      toDate: "",
      location: "",
    },
  });

  const onSubmit = async (data: Values) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const result = await applyForAllowance(data);
      if (result.success) {
        toast.success("Allowance claim submitted successfully!");
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
        {/* From Date */}
        <div className="space-y-1.5">
          <Label htmlFor="fromDate" className={labelClass}>
            From Date
          </Label>
          <Input
            id="fromDate"
            type="date"
            {...register("fromDate")}
            className={inputClass}
          />
          {errors.fromDate && (
            <p className="text-[10px] text-rose-500 font-bold mt-1">
              {errors.fromDate.message}
            </p>
          )}
        </div>

        {/* To Date */}
        <div className="space-y-1.5">
          <Label htmlFor="toDate" className={labelClass}>
            To Date
          </Label>
          <Input
            id="toDate"
            type="date"
            {...register("toDate")}
            className={inputClass}
          />
          {errors.toDate && (
            <p className="text-[10px] text-rose-500 font-bold mt-1">
              {errors.toDate.message}
            </p>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1.5 pt-2 border-t border-border/60">
        <Label htmlFor="location" className={labelClass}>
          Meeting Location / Client Office
        </Label>
        <div className="relative group/input">
          <Input
            id="location"
            type="text"
            placeholder="e.g. Client Office, City Name"
            {...register("location")}
            className={cn(inputClass, "pl-8")}
          />
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
        </div>
        <p className="text-[9px] text-muted-foreground font-medium px-0.5">
          Specify the destination where the business meeting or offsite duty takes place
        </p>
        {errors.location && (
          <p className="text-[10px] text-rose-500 font-bold mt-1">
            {errors.location.message}
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
            <Send className="size-3.5 mr-1.5" /> Submit Allowance Claim
          </>
        )}
      </Button>
    </form>
  );
}

