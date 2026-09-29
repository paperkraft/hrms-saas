"use client";

import { Building2, MapPin, Home, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationStat } from "@/actions/dashboard/admin";
import { Badge } from "@/components/ui/badge";

interface LocationStatusProps {
  locations: LocationStat[];
}

export function LocationStatus({ locations }: LocationStatusProps) {
  const getIcon = (isRemote: boolean) => {
    return isRemote ? Home : Building2;
  };

  const getColor = (rate: number) => {
    if (rate >= 80) return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500" };
    if (rate >= 60) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500" };
    return { text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500" };
  };

  const getLightColor = (isRemote: boolean) => {
    return isRemote ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-primary/10 text-primary";
  };

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs">
      <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-indigo-500 shrink-0" /> Office Location Stats
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
              {locations.length} Sites
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
            Real-time workplace occupancy, headcounts, and presence rates.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {locations.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Navigation className="size-8 opacity-40" />
            <p className="text-xs font-semibold">No location data found</p>
          </div>
        ) : (
          locations.map((loc, idx) => {
            const Icon = getIcon(loc.isRemote);
            const { text: colorText, bg: colorBg } = getColor(loc.attendanceRate);
            const lightColorClass = getLightColor(loc.isRemote);

            return (
              <div key={`loc-${loc.id}-${idx}`} className="p-4 hover:bg-muted/30 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className={cn("size-9 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", lightColorClass)}>
                      <Icon className="size-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{loc.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[11px] text-muted-foreground font-medium">
                          {loc.presentCount} / {loc.totalEmployees} Present
                        </p>
                        {loc.isRemote && (
                          <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25">
                            Remote
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={cn("text-sm font-bold tabular-nums block", colorText)}>
                      {loc.attendanceRate}%
                    </span>
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                      occupancy
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", colorBg)}
                      style={{ width: `${Math.min(loc.attendanceRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
