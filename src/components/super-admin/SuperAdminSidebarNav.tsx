"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  Server,
  HardDrive,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    title: "Overview",
    href: "/super-admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Tenants & Quotas",
    href: "/super-admin/tenants",
    icon: Building2,
    exact: true,
  },
  {
    title: "Onboarding Wizard",
    href: "/super-admin/tenants/onboarding",
    icon: UserPlus,
    exact: false,
    badge: "5-Step",
  },
];

export function SuperAdminSidebarNav() {
  const pathname = usePathname();

  const isItemActive = (item: typeof NAV_ITEMS[0]) => {
    if (!pathname) return false;
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <nav className="p-3 space-y-1">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60">
        Platform Governance
      </div>

      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 group relative",
              active
                ? "bg-primary/10 text-primary font-bold border border-primary/20 shadow-2xs"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary border border-transparent"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors duration-200",
                active
                  ? "text-primary"
                  : "text-sidebar-foreground/70 group-hover:text-primary"
              )}
            />
            <span className="truncate flex-1">{item.title}</span>

            {item.badge && !active && (
              <span className="shrink-0 whitespace-nowrap text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded-xs font-semibold">
                {item.badge}
              </span>
            )}

            {active && (
              <div className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
            )}
          </Link>
        );
      })}

      <div className="pt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60">
        Infrastructure
      </div>

      <div className="mx-1 p-2.5 rounded-md bg-muted/40 border border-border/70 text-xs space-y-2">
        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
          <span className="flex items-center gap-1.5 truncate">
            <Server className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> PostgreSQL Pool
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[9px] font-bold shrink-0">HEALTHY</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
          <span className="flex items-center gap-1.5 truncate">
            <HardDrive className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" /> MinIO Storage
          </span>
          <span className="text-blue-600 dark:text-blue-400 font-mono text-[9px] font-bold shrink-0">CONNECTED</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
          <span className="flex items-center gap-1.5 truncate">
            <Activity className="size-3.5 text-primary shrink-0" /> Edge Router
          </span>
          <span className="text-primary font-mono text-[9px] font-bold shrink-0">ACTIVE</span>
        </div>
      </div>
    </nav>
  );
}
