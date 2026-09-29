"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertCircle, Clock } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface OperationsDetailTableProps {
  summaries: {
    totalLatePunches30Days: number;
    outsideOfficePunches30Days: number;
  };
  dailyTrends: Array<{ dateStr: string; present: number; late: number; outsideOffice: number }>;
  className?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border/80 p-2.5 rounded-md shadow-md text-xs font-medium text-popover-foreground">
        {label && <p className="font-bold border-b border-border/40 pb-1 mb-1">{label}</p>}
        <div className="space-y-1">
          {payload.map((pld: any, index: number) => {
            return (
              <div key={index} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: pld.color || pld.fill }} />
                <span className="text-muted-foreground">{pld.name}:</span>
                <span className="font-bold text-foreground">{pld.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export function OperationsDetailTable({
  summaries,
  dailyTrends,
  className,
}: OperationsDetailTableProps) {
  const [mounted, setMounted] = useState(false);
  const [daysRange, setDaysRange] = useState<7 | 15 | 30>(7);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayedTrends = useMemo(() => {
    return dailyTrends.slice(-daysRange);
  }, [dailyTrends, daysRange]);

  const rangeTotals = useMemo(() => {
    const totalLate = displayedTrends.reduce((acc, t) => acc + (t.late || 0), 0);
    const totalOutside = displayedTrends.reduce((acc, t) => acc + (t.outsideOffice || 0), 0);
    return { totalLate, totalOutside };
  }, [displayedTrends]);

  return (
    <div className={cn("bg-card border border-border/80 rounded-md p-5 space-y-4 shadow-2xs flex flex-col justify-between h-full", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <AlertCircle className="size-3.5 text-primary" /> Organizational Audits
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Daily outside-office arrivals and late punches over the last {daysRange} days.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Days Range Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground hidden sm:inline" />
            <select
              value={daysRange}
              onChange={(e) => setDaysRange(Number(e.target.value) as 7 | 15 | 30)}
              aria-label="Filter by days range"
              className="h-7 px-2 text-xs rounded-md border border-input bg-background font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
            >
              <option value={7}>Last 7 Days</option>
              <option value={15}>Last 15 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>

          <div className="flex gap-3 pl-2 border-l border-border/60">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Late Punches</p>
              <p className="text-base sm:text-lg font-bold tracking-tight text-amber-500 leading-none mt-0.5">{rangeTotals.totalLate}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outside Office</p>
              <p className="text-base sm:text-lg font-bold tracking-tight text-rose-500 leading-none mt-0.5">{rangeTotals.totalOutside}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[210px] w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <AreaChart data={displayedTrends} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="auditLateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="auditOutsideGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
              <XAxis
                dataKey="dateStr"
                tick={{ fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                name="Late Punches"
                dataKey="late"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#auditLateGrad)"
              />
              <Area
                type="monotone"
                name="Outside Office"
                dataKey="outsideOffice"
                stroke="#f43f5e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#auditOutsideGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </div>
  );
}
