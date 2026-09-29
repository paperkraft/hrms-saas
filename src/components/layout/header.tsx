"use client";

import { Search } from "lucide-react";
import { UserNav } from "@/components/layout/user-nav";
import { NotificationNav } from "@/components/layout/notification-nav";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

interface HeaderProps {
  userName: string;
  userRole: string;
  userEmail?: string;
  userAvatar?: string | null;
  userDesignation?: string | null;
  isTeamLeader?: boolean;
}

export function Header({
  userName,
  userRole,
  userEmail = "",
  userAvatar = null,
  userDesignation = null,
}: HeaderProps) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  // Helper to get descriptive page title for all active routes
  const getPageTitle = () => {
    const normPath = pathname ? pathname.replace(/^\/[^/]+(?=\/dashboard)/, "") : pathname;

    // Exact path matches for specific routes
    switch (normPath) {
      case "/dashboard/employee": return "My Space";
      case "/dashboard/external": return "My Space";
      case "/dashboard/projects": return "Project Overview";
      case "/dashboard/projects/reports": return "Tasks";
      case "/dashboard/projects/task-master": return "Task Master";
      case "/dashboard/projects/activity": return "Activity Log";
      case "/dashboard/admin": return "System Overview";
      case "/dashboard/accountant": return "Payroll & Processing";
    }

    // Module-based matches (ordered from most specific to least specific)
    
    // Admin & Developer
    if (pathname.includes("/admin/developer/attendance")) return "Attendance Adjust";
    if (pathname.includes("/admin/users")) return "Employees";
    if (pathname.includes("/admin/settings")) return "Configuration";
    if (pathname.includes("/admin/departments")) return "Departments";
    if (pathname.includes("/admin/reports")) return "Admin Reports";

    // Accountant
    if (pathname.includes("/accountant/users")) return "Employees";
    if (pathname.includes("/accountant/settings")) return "Configuration";
    if (pathname.includes("/location-logs")) return "Daily Attendance";

    // Projects
    if (pathname.includes("/dashboard/projects/")) return "Project Details";

    // Attendance & Leaves
    if (pathname.includes("/leaves/manage")) return "Leave Approvals";
    if (pathname.includes("/employee/attendance") || pathname.includes("/attendance")) return "My Attendance";
    if (pathname.includes("/employee/leaves") || pathname.includes("/leaves")) return "My Leaves";

    // General Workspace
    if (pathname.includes("/profile")) return "My Profile";
    if (pathname.includes("/notifications")) return "Notification Center";
    if (pathname.includes("/calendar")) return "Calendar";
    if (pathname.includes("/org-chart")) return "Organization Chart";
    if (pathname.includes("/policies")) return "Policies";
    if (pathname.includes("/departments")) return "Departments";
    if (pathname.includes("/announcements")) return "Notices";
    if (pathname.includes("/documents")) return "Documents";
    if (pathname.includes("/file-share")) return "File Share";

    return "HR Workspace";
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-4 min-w-0">
        <SidebarTrigger className="-ml-1" />

        {/* Page Title for Desktop */}
        <div className="hidden md:flex items-center text-xs font-semibold select-none min-w-0">
          <span className="text-foreground font-bold truncate text-sm tracking-tight">{getPageTitle()}</span>
        </div>

        {/* Mobile Page Title - Clickable to toggle sidebar */}
        <div
          className="md:hidden flex items-center gap-2 text-sm font-semibold truncate max-w-45 cursor-pointer active:opacity-70 transition-opacity"
          onClick={() => toggleSidebar()}
        >
          <span className="text-foreground truncate">{getPageTitle()}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-3">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
          className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mr-1 md:mr-0 cursor-pointer"
          title="Search (Ctrl+K)"
        >
          <Search className="size-4" />
        </button>
        <NotificationNav />
        <div className="h-6 w-px bg-border/50 mx-1 hidden md:block"></div>
        <UserNav
          userName={userName}
          userEmail={userEmail}
          initialAvatarUrl={userAvatar}
          initialDesignation={userDesignation}
        />
      </div>
    </header>
  );
}

