"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { Clock } from "lucide-react";

export interface DeptLatePattern {
  name: string;
  lateRate: number;
  total: number;
  late: number;
}

export function DepartmentLatePunchChart({ data }: { data: DeptLatePattern[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-sm shadow-xl p-1.5 sm:p-2.5 text-[10px] sm:text-xs text-foreground space-y-0.5 sm:space-y-1">
          <p className="font-bold border-b border-border/50 pb-1 sm:pb-1.5 mb-1 sm:mb-1.5 uppercase tracking-widest leading-none">{data.name}</p>
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <span className="text-muted-foreground font-medium">Late Rate</span>
            <span className="font-mono text-amber-500 font-bold">{data.lateRate}%</span>
          </div>
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <span className="text-muted-foreground font-medium">Late Punches</span>
            <span className="font-mono">{data.late} / {data.total}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs animate-fade-in">
      <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-amber-500 shrink-0" /> Late Punch Rate
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              {data.length} Depts
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Arriving delay ratio percentage by department.
          </p>
        </div>
      </div>

      <div className="p-4 flex-1 w-full overflow-y-auto scrollbar-hide overflow-x-hidden min-h-[220px]">
        {mounted && data.length > 0 ? (
          <div style={{ height: Math.max(220, data.length * 35), width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border)/0.5)" />
                <XAxis type="number" unit="%" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip 
                  content={<CustomTooltip />} 
                  {...(typeof window !== "undefined" && window.innerWidth < 640 ? { position: { x: 80 } } : {})}
                />
                <Bar dataKey="lateRate" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-16">
            <Clock className="size-8 opacity-40" />
            <p className="text-xs font-semibold">No delay logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
