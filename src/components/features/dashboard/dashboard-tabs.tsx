"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, History, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { name: "Dashboard", href: "/dashboard/employee", icon: LayoutDashboard },
  { name: "My Leaves", href: "/dashboard/employee/leaves", icon: CalendarDays },
  { name: "Attendance", href: "/dashboard/employee/attendance", icon: History },
];

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="w-full overflow-x-auto scrollbar-hide no-scrollbar py-0.5">
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md w-fit max-w-full border border-border/70 min-w-max">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 h-8 px-3 sm:px-4 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider sm:tracking-widest transition-all duration-200 whitespace-nowrap",
                isActive
                  ? "bg-card text-primary border border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <tab.icon className={cn("size-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
