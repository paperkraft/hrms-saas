"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, addMonths, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MonthFilterProps {
  baseUrl?: string;
  minDate?: string;
}

export function MonthFilter({ baseUrl = "/dashboard/accountant", minDate }: MonthFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const m = searchParams.get("m");
  const y = searchParams.get("y");

  // Default to current month if no params
  const dateValue = m && y
    ? `${y}-${m.padStart(2, '0')}`
    : format(new Date(), "yyyy-MM");

  const handleDateChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      const [yearStr, monthStr] = val.split('-');
      params.set("y", yearStr);
      params.set("m", monthStr.replace(/^0+/, ''));
      params.delete("d");
    } else {
      params.delete("y");
      params.delete("m");
      params.delete("d");
    }
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const goToPreviousMonth = () => {
    const d = subMonths(parseISO(`${dateValue}-01`), 1);
    const newDateStr = format(d, "yyyy-MM");
    if (!minDate || newDateStr >= minDate) {
      handleDateChange(newDateStr);
    }
  };

  const goToNextMonth = () => {
    const d = addMonths(parseISO(`${dateValue}-01`), 1);
    handleDateChange(format(d, "yyyy-MM"));
  };

  const todayStr = format(new Date(), "yyyy-MM");
  const isFutureOrToday = dateValue >= todayStr;
  const isAtMinDate = minDate ? dateValue <= minDate : false;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={isAtMinDate}
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-all disabled:opacity-30 cursor-pointer"
          title="Previous Month"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="relative group cursor-pointer mx-1 flex items-center">
          <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors z-10 pointer-events-none" />
          <div className="h-7 pl-7 pr-2.5 flex items-center justify-center text-xs font-bold border border-border/60 rounded-md bg-background min-w-[95px] text-foreground text-center select-none">
            {format(parseISO(`${dateValue}-01`), "MMMM")}
          </div>
          <Input
            ref={inputRef}
            type="month"
            value={dateValue}
            max={todayStr}
            min={minDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          disabled={isFutureOrToday}
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-all disabled:opacity-30 cursor-pointer"
          title="Next Month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {(m || y) ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("m");
            params.delete("y");
            params.delete("d");
            router.push(`${baseUrl}?${params.toString()}`);
          }}
          className="h-9 px-3 text-xs font-semibold border-border/80 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
          title="Reset to Current Month"
        >
          <RotateCcw className="size-3" />
          <span>Current Month</span>
        </Button>
      ) : (
        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md uppercase tracking-wider">
          Current Month
        </span>
      )}
    </div>
  );
}
