"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leaveApplicationSchema, type LeaveApplicationValues } from "@/lib/validations/leave";
import { submitLeaveRequest, getEmployeeLeaveBalance } from "@/actions/leave/request";
import { getSystemConfig } from "@/actions/settings";
import { getHolidays } from "@/actions/holiday";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, Clock, Sun, Moon, Send, ChevronRight, ChevronLeft, Check, Sparkles, Ban, Calendar } from "lucide-react";
import { cn, calculateConsecutiveEndDate, getLeavePeriodBreakdown, formatDateKey } from "@/lib/utils";

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-9 bg-muted/20 border-border/80 rounded-md text-xs font-medium focus:ring-primary/20 focus:border-primary";

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Category" },
  { id: 2, label: "Duration" },
  { id: 3, label: "Dates" },
  { id: 4, label: "Reason" },
];

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-between mb-5">
      {STEPS.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "size-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-200",
                done ? "bg-primary text-white shadow-xs" : active ? "bg-primary/10 text-primary border-2 border-primary" : "bg-muted/20 text-muted-foreground/40 border border-border/40"
              )}>
                {done ? <Check className="size-3.5" /> : step.id}
              </div>
              <span className={cn("text-[8px] font-bold uppercase tracking-wider leading-none whitespace-nowrap", active ? "text-primary font-black" : done ? "text-primary/70" : "text-muted-foreground/40")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-px mx-2 mb-4 transition-all duration-300", done ? "bg-primary/40" : "bg-border/40")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LeaveApplicationForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [holidays, setHolidays] = useState<Array<{ id: string; name: string; date: Date | string }>>([]);
  const [balance, setBalance] = useState<{
    remainingFull: number;
    remainingShort: number;
    semiAnnualRemaining: number;
    isProbation: boolean;
    semiAnnualPolicyEnabled: boolean;
    month: number;
    year: number;
  } | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [step, setStep] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors },
  } = useForm<LeaveApplicationValues>({
    resolver: zodResolver(leaveApplicationSchema),
    mode: "onChange",
    defaultValues: {
      duration: "FULL",
      category: "MONTHLY_POLICY_1",
    },
  });

  const selectedCategory = watch("category");
  const selectedDuration = watch("duration");
  const selectedHalf = watch("halfDayType");
  const startDate = watch("startDate");
  const endDate = watch("endDate");

  useEffect(() => { 
    getSystemConfig().then(setConfig);
    getHolidays().then((res) => {
      if (res?.success && res.data) {
        setHolidays(res.data);
      }
    });
  }, []);

  // Fetch live leave balance on mount and whenever start date month/year changes
  useEffect(() => {
    let active = true;
    const targetDate = startDate ? new Date(startDate) : new Date();
    const m = targetDate.getMonth() + 1;
    const y = targetDate.getFullYear();

    setIsLoadingBalance(true);
    getEmployeeLeaveBalance(m, y).then((res) => {
      if (active && res) {
        setBalance(res);
        setIsLoadingBalance(false);
      }
    });

    return () => { active = false; };
  }, [startDate]);

  // Auto-Adjust End Date for Earned Leave (3 consecutive working days)
  useEffect(() => {
    if (selectedCategory === "SEMI_ANNUAL_POLICY_2" && startDate) {
      const holidayDates = holidays.map(h => h.date);
      const autoEnd = calculateConsecutiveEndDate(startDate, 3, holidayDates);
      setValue("endDate", autoEnd, { shouldValidate: true });
    }
  }, [selectedCategory, startDate, holidays, setValue]);

  // Smart Auto-Fallback: If currently selected category has 0 quota, switch to an available one
  useEffect(() => {
    if (!balance) return;

    const monthlyAvailable = balance.remainingFull > 0 || balance.remainingShort > 0;
    const earnedAvailable = !balance.isProbation && balance.semiAnnualPolicyEnabled && balance.semiAnnualRemaining > 0;

    if (selectedCategory === "MONTHLY_POLICY_1" && !monthlyAvailable) {
      if (earnedAvailable) {
        setValue("category", "SEMI_ANNUAL_POLICY_2");
      } else {
        setValue("category", "UNPAID");
      }
    } else if (selectedCategory === "SEMI_ANNUAL_POLICY_2" && !earnedAvailable) {
      if (monthlyAvailable) {
        setValue("category", "MONTHLY_POLICY_1");
      } else {
        setValue("category", "UNPAID");
      }
    }
  }, [balance, selectedCategory, setValue]);

  // Smart Duration Fallback
  useEffect(() => {
    if (!balance) return;

    if (selectedCategory === "MONTHLY_POLICY_1") {
      if (balance.remainingFull <= 0 && balance.remainingShort > 0 && selectedDuration !== "SHORT") {
        setValue("duration", "SHORT");
      } else if (balance.remainingShort <= 0 && balance.remainingFull > 0 && selectedDuration === "SHORT") {
        setValue("duration", balance.remainingFull >= 1 ? "FULL" : "HALF");
      } else if (balance.remainingFull === 0.5 && selectedDuration === "FULL") {
        setValue("duration", "HALF");
      }
    } else if (selectedCategory === "SEMI_ANNUAL_POLICY_2") {
      if (selectedDuration !== "FULL") {
        setValue("duration", "FULL");
      }
    }
  }, [balance, selectedCategory, selectedDuration, setValue]);

  useEffect(() => {
    if (selectedCategory !== "MONTHLY_POLICY_1") setValue("leaveType", undefined);
  }, [selectedCategory, setValue]);

  useEffect(() => {
    if ((selectedDuration === "HALF" || selectedDuration === "SHORT") && startDate) setValue("endDate", startDate);
  }, [selectedDuration, startDate, setValue]);

  const startTime = watch("startTime");
  useEffect(() => {
    if (selectedDuration === "SHORT" && startTime) {
      const [hours, minutes] = startTime.split(":").map(Number);
      const endHours = (hours + 2) % 24;
      setValue("endTime", `${endHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`);
    }
  }, [startTime, selectedDuration, setValue]);

  useEffect(() => {
    if (selectedDuration !== "SHORT") { setValue("startTime", undefined); setValue("endTime", undefined); }
    if (selectedDuration === "FULL") setValue("halfDayType", undefined);
  }, [selectedDuration, setValue]);

  const semiAnnualEnabled = config?.semiAnnualPolicyEnabled ?? true;

  // ── Step validation guards ────────────────────────────────────────────────
  const canAdvance = async (currentStep: number): Promise<boolean> => {
    if (currentStep === 1) return await trigger(["category", "leaveType"]);
    if (currentStep === 2) return await trigger(["duration", "halfDayType"]);
    if (currentStep === 3) return await trigger(["startDate", "endDate", "startTime", "endTime"]);
    return true;
  };

  const handleNext = async () => {
    if (await canAdvance(step)) setStep(s => Math.min(s + 1, STEPS.length));
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const onSubmit = async (data: LeaveApplicationValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const result = await submitLeaveRequest(data);
      if (result.error) { setServerError(result.error); toast.error(result.error); return; }
      toast.success("Leave application submitted successfully!");
      reset();
      setStep(1);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      const msg = error.message || "Failed to submit leave request.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shared section renderers ──────────────────────────────────────────────
  const renderCategory = () => {
    const monthlyAvailable = !balance || (balance.remainingFull > 0 || balance.remainingShort > 0);
    const earnedAvailable = !balance || (!balance.isProbation && balance.semiAnnualPolicyEnabled && balance.semiAnnualRemaining > 0);

    const categories = [
      {
        id: "MONTHLY_POLICY_1",
        label: "Monthly Leave",
        sub: isLoadingBalance
          ? "Checking quota..."
          : balance && balance.remainingFull > 0
            ? `${balance.remainingFull}d Full · ${balance.remainingShort} Short left`
            : balance && balance.remainingShort > 0
              ? `0d Full · ${balance.remainingShort} Short left`
              : "0 left · Quota exhausted",
        disabled: !isLoadingBalance && !monthlyAvailable,
        badge: balance && balance.remainingFull > 0 ? `${balance.remainingFull}d` : null,
      },
      ...(semiAnnualEnabled ? [{
        id: "SEMI_ANNUAL_POLICY_2",
        label: "Earned Leave",
        sub: isLoadingBalance
          ? "Checking quota..."
          : balance?.isProbation
            ? "Probation Ineligible"
            : balance && balance.semiAnnualRemaining > 0
              ? `${balance.semiAnnualRemaining}d left (Hangout 3+ d)`
              : "0 left in cycle",
        disabled: !isLoadingBalance && !earnedAvailable,
        badge: balance && !balance.isProbation && balance.semiAnnualRemaining > 0 ? `${balance.semiAnnualRemaining}d` : null,
      }] : []),
      {
        id: "UNPAID",
        label: "Unpaid Leave",
        sub: "Unlimited · No balance required",
        disabled: false,
        badge: "Unlimited",
      }
    ];

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className={labelClass}>Leave Category</Label>
            {balance && (
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                Monthly Quota: <strong className="text-primary">{balance.remainingFull}d Full</strong> · <strong className="text-primary">{balance.remainingShort} Short</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const isDisabled = cat.disabled;

              const styles: Record<string, { border: string; bg: string; ring: string; text: string }> = {
                MONTHLY_POLICY_1: { border: "border-primary", bg: "bg-primary/5", ring: "ring-primary/20", text: "text-primary" },
                SEMI_ANNUAL_POLICY_2: { border: "border-amber-500", bg: "bg-amber-500/5", ring: "ring-amber-500/20", text: "text-amber-600 dark:text-amber-400" },
                UNPAID: { border: "border-rose-500", bg: "bg-rose-500/5", ring: "ring-rose-500/20", text: "text-rose-600 dark:text-rose-400" },
              };
              const s = styles[cat.id] || styles.MONTHLY_POLICY_1;

              return (
                <label 
                  key={cat.id} 
                  className={cn(
                    "relative flex flex-col justify-between p-3 rounded-md border transition-all shadow-2xs select-none",
                    isDisabled
                      ? "opacity-45 cursor-not-allowed bg-muted/20 border-dashed border-border/70 text-muted-foreground"
                      : isSelected 
                        ? `${s.border} ${s.bg} ring-1 ${s.ring} cursor-pointer` 
                        : "border-border/80 bg-muted/10 hover:bg-muted/20 cursor-pointer"
                  )}
                >
                  <input 
                    type="radio" 
                    value={cat.id} 
                    disabled={isDisabled} 
                    className="sr-only" 
                    {...register("category")} 
                  />
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className={cn("text-xs font-bold", isSelected && !isDisabled ? s.text : "text-foreground")}>
                        {cat.label}
                      </span>
                      {isDisabled && (
                        <Ban className="size-3 text-muted-foreground/60 shrink-0" />
                      )}
                    </div>
                    <span className={cn(
                      "text-[9px] font-medium tracking-tight block leading-tight",
                      isDisabled ? "text-rose-500/80 font-semibold" : "text-muted-foreground uppercase"
                    )}>
                      {cat.sub}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
          {errors.category && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.category.message}</p>}
        </div>

        {selectedCategory === "MONTHLY_POLICY_1" && (
          <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-md space-y-2 animate-fade-in">
            <Label className="text-[10px] font-black text-primary uppercase tracking-wider">Type of Leave</Label>
            <div className="grid grid-cols-2 gap-2.5">
              {[{ id: "CASUAL", label: "Casual Leave", sub: "Standard allowance" }, { id: "MEDICAL", label: "Sick / Medical", sub: "Health recovery" }].map((type) => (
                <label key={type.id} className={cn("relative flex flex-col p-2.5 cursor-pointer rounded-md border transition-all", watch("leaveType") === type.id ? "border-primary bg-primary/10 text-primary shadow-xs" : "border-border/80 bg-card hover:bg-muted/10")}>
                  <input type="radio" value={type.id} className="sr-only" {...register("leaveType")} />
                  <span className="text-xs font-bold">{type.label}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">{type.sub}</span>
                </label>
              ))}
            </div>
            {errors.leaveType && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.leaveType.message}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderDuration = () => {
    // Duration disabling based on quota
    const fullDisabled = selectedCategory === "MONTHLY_POLICY_1" && balance !== null && balance.remainingFull < 1;
    const halfDisabled = (selectedCategory === "MONTHLY_POLICY_1" && balance !== null && balance.remainingFull <= 0) || selectedCategory === "SEMI_ANNUAL_POLICY_2";
    const shortDisabled = (selectedCategory === "MONTHLY_POLICY_1" && balance !== null && balance.remainingShort <= 0) || selectedCategory === "SEMI_ANNUAL_POLICY_2";

    const durationOptions = [
      { id: "FULL", label: "Full Day", disabled: fullDisabled, note: fullDisabled && balance && balance.remainingFull > 0 ? "Only 0.5d left" : fullDisabled ? "0d left" : null },
      { id: "HALF", label: "Half Day", disabled: halfDisabled, note: halfDisabled && selectedCategory === "MONTHLY_POLICY_1" ? "0d left" : null },
      { id: "SHORT", label: "Short (2h)", disabled: shortDisabled, note: shortDisabled && selectedCategory === "MONTHLY_POLICY_1" ? "Quota used" : null },
    ];

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="space-y-2">
          <Label className={labelClass}>Duration</Label>
          <div className="grid grid-cols-3 gap-2.5">
            {durationOptions.map((opt) => {
              const isSelected = selectedDuration === opt.id;
              const isDisabled = opt.disabled;

              return (
                <label 
                  key={opt.id} 
                  className={cn(
                    "flex flex-col items-center justify-center py-2.5 px-3 rounded-md border transition-all text-xs font-bold uppercase tracking-wider shadow-2xs select-none",
                    isDisabled
                      ? "opacity-40 cursor-not-allowed bg-muted/20 border-dashed border-border/70 text-muted-foreground"
                      : isSelected 
                        ? "bg-primary text-white border-primary shadow-xs cursor-pointer" 
                        : "bg-muted/10 border-border/80 hover:bg-muted/20 text-foreground cursor-pointer"
                  )}
                >
                  <input 
                    type="radio" 
                    value={opt.id} 
                    disabled={isDisabled} 
                    className="sr-only" 
                    {...register("duration")} 
                  />
                  <span>{opt.label}</span>
                  {opt.note && (
                    <span className="text-[8px] font-semibold lowercase tracking-tight opacity-75 mt-0.5">{opt.note}</span>
                  )}
                </label>
              );
            })}
          </div>
          {errors.duration && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.duration.message}</p>}
        </div>

        {selectedDuration === "HALF" && (
          <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-md space-y-2 animate-fade-in">
            <Label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Select Session</Label>
            <div className="grid grid-cols-2 gap-2.5">
              {[{ id: "FIRST_HALF", label: "First Half", icon: Sun }, { id: "SECOND_HALF", label: "Second Half", icon: Moon }].map((session) => {
                const isSelected = selectedHalf === session.id;
                const sc = { FIRST_HALF: { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" }, SECOND_HALF: { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" } }[session.id]!;
                return (
                  <label key={session.id} className={cn("flex items-center gap-2 p-2.5 cursor-pointer rounded-md border transition-all", isSelected ? `${sc.border} ${sc.bg} shadow-xs` : "border-border/80 bg-card hover:bg-muted/10")}>
                    <input type="radio" value={session.id} className="sr-only" {...register("halfDayType")} />
                    <session.icon className={cn("size-3.5", isSelected ? sc.text : "text-muted-foreground/50")} />
                    <span className="text-xs font-bold">{session.label}</span>
                  </label>
                );
              })}
            </div>
            {errors.halfDayType && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.halfDayType.message}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderDates = () => {
    const breakdown = (startDate && endDate) ? getLeavePeriodBreakdown(startDate, endDate, holidays) : null;
    const startObj = startDate ? new Date(startDate) : null;
    let daysInAdvance: number | null = null;
    let isAutoApprovedEstimated = false;

    if (startObj && !isNaN(startObj.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startMid = new Date(startObj);
      startMid.setHours(0, 0, 0, 0);
      daysInAdvance = Math.round((startMid.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (selectedCategory === "SEMI_ANNUAL_POLICY_2") {
        isAutoApprovedEstimated = daysInAdvance >= 7;
      } else {
        isAutoApprovedEstimated = daysInAdvance > 0;
      }
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={labelClass}>Starting Date</Label>
              <Input type="date" {...register("startDate")} className={inputClass} />
              {errors.startDate && <p className="text-[10px] text-rose-500 font-bold">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Ending Date</Label>
              <Input 
                type="date" 
                {...register("endDate")} 
                disabled={selectedDuration === "HALF" || selectedDuration === "SHORT"} 
                className={cn(inputClass, (selectedDuration === "HALF" || selectedDuration === "SHORT") && "opacity-50")} 
              />
              {errors.endDate && <p className="text-[10px] text-rose-500 font-bold">{errors.endDate.message}</p>}
            </div>
          </div>
        </div>

        {/* Approval Route Indicator */}
        {startDate && daysInAdvance !== null && (
          <div className={cn(
            "p-2.5 rounded-md border text-[11px] font-medium flex items-center justify-between gap-2 animate-fade-in",
            isAutoApprovedEstimated 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
              : "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
          )}>
            <div className="flex items-center gap-1.5">
              <span className="font-bold uppercase tracking-wider text-[10px]">
                {isAutoApprovedEstimated ? "✓ Approved on Submission" : "🛡️ Admin Approval Required"}
              </span>
            </div>
            <span className="text-[10px] opacity-85">
              {isAutoApprovedEstimated 
                ? (selectedCategory === "SEMI_ANNUAL_POLICY_2" ? "Notice >= 7 days" : "Future date notice")
                : (selectedCategory === "SEMI_ANNUAL_POLICY_2" ? "Notice < 7 days requires Admin review" : "Same-day / Past date requires Admin review")}
            </span>
          </div>
        )}

        {/* Earned Leave / 3-Consecutive-Day Auto-Adjustment Banner */}
        {selectedCategory === "SEMI_ANNUAL_POLICY_2" && startDate && endDate && breakdown && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md space-y-2 animate-fade-in">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <Sparkles className="size-3.5" /> Earned Leave (3-Day Policy Auto-Adjusted)
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
                {breakdown.workingDays} working {breakdown.workingDays === 1 ? "day" : "days"} · {breakdown.totalCalendarDays} total {breakdown.totalCalendarDays === 1 ? "day" : "days"} off
              </span>
            </div>
            
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Earned leave requires 3 working days. Sundays and Public Holidays in between are automatically skipped and adjusted to the next working day so you get your complete break.
            </p>

            {(breakdown.sundaysCount > 0 || breakdown.holidaysFound.length > 0) && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {breakdown.sundaysCount > 0 && (
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                    {breakdown.sundaysCount} {breakdown.sundaysCount === 1 ? "Sunday" : "Sundays"} (Weekly off)
                  </span>
                )}
                {breakdown.holidaysFound.map(h => (
                  <span key={h.date} className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                    {h.name} ({h.date})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* General Summary for Monthly / Unpaid if Sundays/Holidays fall in between */}
        {selectedCategory !== "SEMI_ANNUAL_POLICY_2" && selectedDuration === "FULL" && startDate && endDate && startDate !== endDate && breakdown && (
          <div className="p-2.5 bg-muted/20 border border-border/70 rounded-md text-[11px] space-y-1 text-muted-foreground animate-fade-in">
            <div className="flex items-center justify-between font-semibold text-foreground">
              <span>Leave Summary:</span>
              <span className="text-primary font-bold">{breakdown.workingDays} working days to be deducted</span>
            </div>
            {(breakdown.sundaysCount > 0 || breakdown.holidaysFound.length > 0) && (
              <p className="text-[10px] opacity-80">
                Excludes {breakdown.sundaysCount > 0 ? `${breakdown.sundaysCount} Sunday(s)` : ""} 
                {breakdown.sundaysCount > 0 && breakdown.holidaysFound.length > 0 ? " and " : ""}
                {breakdown.holidaysFound.length > 0 ? `${breakdown.holidaysFound.length} Public Holiday(s)` : ""} in between.
              </p>
            )}
          </div>
        )}

        {selectedDuration === "SHORT" && (
          <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-md space-y-2 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-primary uppercase flex items-center gap-1.5"><Clock className="size-3.5" /> Time From</Label>
                <Input type="time" {...register("startTime")} className="h-9 text-xs bg-card border-border/80 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-primary uppercase flex items-center gap-1.5"><Clock className="size-3.5" /> Time To</Label>
                <Input type="time" {...register("endTime")} className="h-9 text-xs bg-card border-border/80 rounded-md" />
              </div>
            </div>
            {(errors.startTime || errors.endTime) && (
              <p className="text-[10px] text-rose-500 font-bold">{errors.startTime?.message || errors.endTime?.message}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReason = () => (
    <div className="space-y-2 animate-fade-in">
      <Label className={labelClass}>Reason / Statement</Label>
      <Textarea placeholder="Explain reason for leave request..." className="min-h-[100px] bg-muted/20 border-border/80 text-xs rounded-md resize-none focus:ring-primary/20" {...register("reason")} />
      {errors.reason && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.reason.message}</p>}
    </div>
  );

  // ── MOBILE STEPPER LAYOUT ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 animate-fade-in">
        <StepIndicator current={step} total={STEPS.length} />

        <div className="min-h-[220px]">
          {step === 1 && renderCategory()}
          {step === 2 && renderDuration()}
          {step === 3 && renderDates()}
          {step === 4 && renderReason()}
        </div>

        {serverError && (
          <div className="bg-rose-500/5 text-rose-600 text-xs p-3 rounded-md flex items-center gap-2 border border-rose-500/20">
            <AlertCircle className="size-4 shrink-0" />
            <span className="font-semibold">{serverError}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 1 && (
            <Button type="button" variant="outline" className="flex-1 h-9 text-xs font-semibold rounded-md border-border/80 cursor-pointer" onClick={handleBack}>
              <ChevronLeft className="size-4 mr-1" /> Back
            </Button>
          )}
          {step < STEPS.length ? (
            <Button type="button" className="flex-1 h-9 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-md cursor-pointer" onClick={handleNext}>
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button type="submit" className="flex-1 h-9 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-md shadow-xs cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : <><Send className="size-3.5 mr-1.5" /> Submit Application</>}
            </Button>
          )}
        </div>
      </form>
    );
  }

  // ── DESKTOP SINGLE-PAGE LAYOUT ────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 animate-fade-in">
      {renderCategory()}
      <div className="pt-2 border-t border-border/60">{renderDuration()}</div>
      <div>{renderDates()}</div>
      <div className="pt-2 border-t border-border/60">{renderReason()}</div>

      {serverError && (
        <div className="bg-rose-500/5 text-rose-600 text-xs p-3 rounded-md flex items-center gap-2 border border-rose-500/20">
          <AlertCircle className="size-4 shrink-0" />
          <span className="font-semibold">{serverError}</span>
        </div>
      )}

      <Button type="submit" className="w-full h-9 bg-primary hover:bg-primary/90 text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : <><Send className="size-3.5 mr-1.5" /> Submit Application</>}
      </Button>
    </form>
  );
}
