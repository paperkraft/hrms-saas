"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, addDays, subDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DateFilterProps {
  currentDate?: string | null;
  baseUrl?: string;
}

export function DateFilter({ currentDate, baseUrl = "/dashboard/accountant" }: DateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // If no date is provided, default to today for the input
  const dateValue = currentDate || format(new Date(), "yyyy-MM-dd");

  const handleDateChange = (date: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (date) {
      params.set("d", date);
      params.delete("m");
      params.delete("y");
    } else {
      params.delete("d");
    }
    router.push(`${baseUrl}?${params.toString()}`);
  };

  const goToPreviousDay = () => {
    const d = subDays(parseISO(dateValue), 1);
    handleDateChange(format(d, "yyyy-MM-dd"));
  };

  const goToNextDay = () => {
    const d = addDays(parseISO(dateValue), 1);
    handleDateChange(format(d, "yyyy-MM-dd"));
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isToday = dateValue === todayStr;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousDay}
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-all cursor-pointer"
          title="Previous Day"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="relative group cursor-pointer mx-1">
          <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors z-10 pointer-events-none" />
          <Input
            ref={inputRef}
            type="date"
            value={dateValue}
            max={todayStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="h-7 pl-8 pr-2 text-xs font-semibold border-border/60 focus:ring-primary/20 transition-all rounded-md bg-background w-[135px] cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextDay}
          disabled={isToday}
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-all disabled:opacity-30 cursor-pointer"
          title="Next Day"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {!currentDate ? (
        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md uppercase tracking-wider">
          Live Today
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            const params = new URLSearchParams(searchParams.toString());
            params.delete("d");
            router.push(`${baseUrl}?${params.toString()}`);
          }}
          className="h-9 px-3 text-xs font-semibold border-border/80 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
          title="Reset to Today"
        >
          <RotateCcw className="size-3" />
          <span>Today</span>
        </Button>
      )}
    </div>
  );
}
