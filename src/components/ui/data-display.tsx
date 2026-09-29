import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  icon?: ReactNode;
  iconClassName?: string;
  label: string;
  value: string | number;
  valueSuffix?: string;
  subValue?: string;
  progress?: number; // 0 to 100
  progressColor?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  icon,
  iconClassName,
  label,
  value,
  valueSuffix,
  subValue,
  progress,
  progressColor = "bg-primary",
  className,
  onClick,
}: StatCardProps) {
  let defaultIconStyle = "bg-primary/10 text-primary";
  if (iconClassName) {
    defaultIconStyle = iconClassName;
  } else if (progressColor.includes("emerald")) {
    defaultIconStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  } else if (progressColor.includes("amber")) {
    defaultIconStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  } else if (progressColor.includes("rose")) {
    defaultIconStyle = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  } else if (progressColor.includes("sky") || progressColor.includes("blue")) {
    defaultIconStyle = "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  } else if (progressColor.includes("indigo") || progressColor.includes("purple")) {
    defaultIconStyle = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-md border border-border/80 bg-card/90 p-4 shadow-2xs hover:border-border transition-all flex flex-col justify-between group",
        onClick && "cursor-pointer hover:shadow-xs",
        className
      )}
    >
      <div className="flex items-center justify-between text-muted-foreground mb-1.5">
        <span className="text-xs font-medium truncate pr-2">{label}</span>
        {icon && (
          <div className={cn("size-8 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", defaultIconStyle)}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mt-auto">
        <span className="text-2xl font-bold text-foreground tracking-tight leading-none group-hover:text-primary transition-colors">
          {value}
        </span>
        {valueSuffix && (
          <span className="text-xs font-semibold text-muted-foreground">{valueSuffix}</span>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", progressColor)}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}

      {subValue && (
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
          <span className={cn("inline-block size-1.5 rounded-full shrink-0", progressColor)} />
          <span className="truncate">{subValue}</span>
        </div>
      )}
    </div>
  );
}
