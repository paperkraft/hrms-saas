"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { submitGrievance, GrievanceType } from "@/actions/attendance/grievance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-9 bg-muted/20 border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 focus:border-primary w-full";

export function GrievanceForm({ onComplete }: { onComplete?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState("");
  const [grievanceType, setGrievanceType] = useState<GrievanceType>("FORGOT_PUNCH_IN");
  const [requestedTime, setRequestedTime] = useState("");
  const [requestedOutTime, setRequestedOutTime] = useState("");
  const [reason, setReason] = useState("");

  const maxDate = format(new Date(), "yyyy-MM-dd");
  const minDate = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !requestedTime || !reason) {
      toast.error("Please fill all required fields");
      return;
    }
    if (grievanceType === "FORGOT_BOTH" && !requestedOutTime) {
      toast.error("Please provide both In and Out times");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitGrievance({
        date: new Date(date),
        grievanceType,
        requestedTime,
        requestedOutTime: grievanceType === "FORGOT_BOTH" ? requestedOutTime : undefined,
        reason,
      });

      if (res.success) {
        toast.success(res.message);
        setDate("");
        setRequestedTime("");
        setRequestedOutTime("");
        setReason("");
        if (onComplete) onComplete();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit grievance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className={labelClass}>Missed Date</Label>
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            min={minDate}
            max={maxDate}
            className={inputClass}
            required 
          />
          <p className="text-[9px] text-muted-foreground font-medium">Limited to last 7 days</p>
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Missed Punch Type</Label>
          <Select value={grievanceType} onValueChange={(val) => setGrievanceType(val as GrievanceType)}>
            <SelectTrigger className="h-9 bg-muted/20 border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 focus:border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-md border-border/80">
              <SelectItem value="FORGOT_PUNCH_IN">Forgot Punch In</SelectItem>
              <SelectItem value="FORGOT_PUNCH_OUT">Forgot Punch Out</SelectItem>
              <SelectItem value="FORGOT_BOTH">Forgot Both (In & Out)</SelectItem>
              <SelectItem value="OTHER">Other Issue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={grievanceType === "FORGOT_BOTH" ? "grid grid-cols-2 gap-4" : "space-y-1.5"}>
        <div className="space-y-1.5">
          <Label className={labelClass}>
            {grievanceType === "FORGOT_PUNCH_OUT" ? "Actual Punch Out Time" : "Actual Punch In Time"}
          </Label>
          <Input 
            type="time" 
            value={requestedTime} 
            onChange={(e) => setRequestedTime(e.target.value)} 
            className={inputClass}
            required 
          />
        </div>
        {grievanceType === "FORGOT_BOTH" && (
          <div className="space-y-1.5">
            <Label className={labelClass}>Actual Punch Out Time</Label>
            <Input 
              type="time" 
              value={requestedOutTime} 
              onChange={(e) => setRequestedOutTime(e.target.value)} 
              className={inputClass}
              required 
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className={labelClass}>Reason & Context</Label>
        <Textarea 
          placeholder="Briefly explain why punch was missed (e.g. biometric device error, urgent client site visit directly from home)..." 
          value={reason} 
          onChange={(e) => setReason(e.target.value)} 
          className="min-h-[90px] bg-muted/20 border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 focus:border-primary resize-none"
          required 
        />
      </div>

      <Button 
        type="submit" 
        disabled={isSubmitting} 
        className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-2xs cursor-pointer"
      >
        {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-2" /> : null}
        Submit Missed Attendance Grievance
      </Button>
    </form>
  );
}
