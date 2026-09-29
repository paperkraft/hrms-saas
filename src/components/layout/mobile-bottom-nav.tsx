"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Activity, FileText, CheckSquare, User, Settings2, MapPin, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

const employeeNav = [
  { title: "Home", href: "/dashboard/employee", icon: Home },
  { title: "Attendance", href: "/dashboard/employee/attendance", icon: Activity },
  { title: "Leave", href: "/dashboard/employee/leaves", icon: FileText },
  { title: "Task", href: "/dashboard/projects/reports", icon: CheckSquare },
  { title: "Project", href: "/dashboard/projects", icon: FolderKanban },
];

const adminNav = [
  { title: "Home", href: "/dashboard/admin", icon: Home },
  { title: "Attendance", href: "/dashboard/accountant/location-logs", icon: MapPin },
  { title: "Settings", href: "/dashboard/admin/settings", icon: Settings2 },
  { title: "Project", href: "/dashboard/projects", icon: FolderKanban },
  { title: "Task", href: "/dashboard/projects/reports", icon: CheckSquare },
];

const accountantNav = [
  { title: "Home", href: "/dashboard/employee", icon: Home },
  { title: "Payroll", href: "/dashboard/accountant", icon: Activity },
  { title: "Leave", href: "/dashboard/employee/leaves", icon: FileText },
  { title: "Task", href: "/dashboard/projects/reports", icon: CheckSquare },
  { title: "Profile", href: "/dashboard/profile", icon: User },
];

const hrNav = [
  { title: "Home", href: "/dashboard/employee", icon: Home },
  { title: "Attendance", href: "/dashboard/accountant/location-logs", icon: MapPin },
  { title: "Leave", href: "/dashboard/leaves/manage", icon: FileText },
  { title: "Employees", href: "/dashboard/admin/users", icon: User },
  { title: "Project", href: "/dashboard/projects", icon: FolderKanban },
];

const externalNav = [
  { title: "Home", href: "/dashboard/external", icon: Home },
  { title: "Project", href: "/dashboard/projects", icon: FolderKanban },
  { title: "Task", href: "/dashboard/projects/reports", icon: CheckSquare },
  { title: "Profile", href: "/dashboard/profile", icon: User },
];

const navByRole: Record<string, typeof employeeNav> = {
  EMPLOYEE: employeeNav,
  HR: hrNav,
  ACCOUNTANT: accountantNav,
  ADMIN: adminNav,
  SYSTEM_ADMIN: adminNav,
  EXTERNAL_USER: externalNav,
};

export function MobileBottomNav({ userRole, userAllowedMenus }: { userRole: string; userAllowedMenus?: string[] }) {
  const pathname = usePathname();
  let navItems = navByRole[userRole] ?? employeeNav;

  if (userAllowedMenus && !userAllowedMenus.includes("all")) {
    navItems = navItems.filter(item => userAllowedMenus.includes(item.href));
  }

  if (navItems.length === 0) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-13 bg-card/95 backdrop-blur-md border-t border-border/70 shadow-lg pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center justify-around h-full max-w-md mx-auto px-1">
        {navItems.map((item) => {
          let isActive = pathname === item.href;
          if (!isActive && item.href !== "/dashboard/employee" && item.href !== "/dashboard/admin") {
            if (item.href === "/dashboard/projects") {
              isActive = pathname.startsWith("/dashboard/projects/") &&
                !pathname.includes("/reports") &&
                !pathname.includes("/activity") &&
                !pathname.includes("/task-master");
            } else {
              isActive = pathname.startsWith(item.href);
            }
          }

          return (
            <Link
              key={item.href + item.title}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 relative select-none transition-all duration-150 active:scale-95 group",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Subtle top indicator bar */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary" />
              )}

              <div className={cn(
                "flex items-center justify-center size-7 rounded-md transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground group-hover:text-foreground"
              )}>
                <item.icon className={cn(
                  "size-4 transition-transform duration-200",
                  isActive ? "stroke-[2.2] scale-105" : "stroke-[1.7]"
                )} />
              </div>

              <span className={cn(
                "text-[9px] font-bold tracking-tight uppercase leading-none mt-0.5",
                isActive ? "text-primary font-extrabold" : "text-muted-foreground/80"
              )}>
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
