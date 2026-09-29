import {
  Home,
  Users,
  Calculator,
  FileText,
  Settings,
  ShieldCheck,
  KeyRound,
  LayoutDashboard,
  Building2,
  Activity,
  MapPin,
  CalendarDays,
  Megaphone,
  BookOpen,
  FolderKanban,
  Users2,
  ListChecks,
  CheckSquare,
  History,
  Library as LibraryIcon,
  Share2,
  Sparkles,
  CalendarPlus
} from "lucide-react";
import { isExternalUser } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  description?: string;
  icon: any;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export type MenuItem = {
  title: string;
  path: string;
  description?: string;
  icon?: any;
};

export type MenuGroup = {
  group: string;
  items: MenuItem[];
};

/**
 * Centralized Single Source of Truth for all assignable menus in Sigma HRMS.
 * Standard Sequence:
 * 1. My Workspace (Personal tools)
 * 2. General (Company-wide directory & knowledge)
 * 3. Administration (Admin & Operations management)
 * 4. Accounting & Finance
 * 5. Project Workspace
 */
export const AVAILABLE_MENUS: MenuGroup[] = [
  {
    group: "My Workspace",
    items: [
      { title: "My Space (Employee)", path: "/dashboard/employee", description: "Internal employee dashboard workspace", icon: Home },
      { title: "My Space (External)", path: "/dashboard/external", description: "External collaborator workspace and resources", icon: Home },
      { title: "My Attendance", path: "/dashboard/employee/attendance", description: "Personal attendance history and logs", icon: Activity },
      { title: "My Leaves", path: "/dashboard/employee/leaves", description: "Leave balance, applications, and status", icon: FileText },
    ]
  },
  {
    group: "General",
    items: [
      { title: "Notices", path: "/dashboard/announcements", description: "Company bulletins and announcements", icon: Megaphone },
      { title: "Policies", path: "/dashboard/policies", description: "Company policies and guidelines", icon: BookOpen },
      { title: "Calendar", path: "/dashboard/calendar", description: "Company holidays, events, and calendar", icon: CalendarDays },
      { title: "Documents", path: "/dashboard/documents", description: "Shared templates and documents", icon: LibraryIcon },
      { title: "File Share", path: "/dashboard/file-share", description: "Department and peer file exchange", icon: Share2 },
      { title: "Organization", path: "/dashboard/org-chart", description: "Company structure and team hierarchy", icon: Users2 },
    ]
  },
  {
    group: "Administration",
    items: [
      { title: "System Overview", path: "/dashboard/admin", description: "Operational overview and workforce stats", icon: LayoutDashboard },
      { title: "Leave Approvals", path: "/dashboard/leaves/manage", description: "Review and approve employee leave requests", icon: FileText },
      { title: "Employees", path: "/dashboard/admin/users", description: "Manage organizational workforce and accounts", icon: Users },
      { title: "Departments", path: "/dashboard/departments", description: "Department directory and team structure", icon: Building2 },
      { title: "Roles & Permissions", path: "/dashboard/admin/roles", description: "Configure system and custom dynamic roles", icon: KeyRound },
      { title: "Daily Attendance", path: "/dashboard/accountant/location-logs", description: "Live team punch logs and location map", icon: MapPin },
      { title: "Configuration", path: "/dashboard/admin/settings", description: "System settings and office locations", icon: Settings },
    ]
  },
  {
    group: "Accounting & Finance",
    items: [
      { title: "Payroll & Processing", path: "/dashboard/accountant", description: "Salary structures, ledgers, and payslips", icon: Calculator },
    ]
  },
  {
    group: "Project Workspace",
    items: [
      { title: "Project Overview", path: "/dashboard/projects", description: "Active projects, milestones, and status", icon: FolderKanban },
      { title: "Tasks", path: "/dashboard/projects/reports", description: "Personal and team task management board", icon: CheckSquare },
      { title: "Task Master", path: "/dashboard/projects/task-master", description: "Pre-defined task templates and workflows", icon: ListChecks },
    ]
  }
];

export const allNavigationRegistry: NavGroup[] = AVAILABLE_MENUS.map(g => ({
  title: g.group,
  items: g.items.map(i => ({
    title: (i.path === "/dashboard/employee" || i.path === "/dashboard/external") ? "My Space" : i.title,
    href: i.path,
    icon: i.icon
  }))
}));

export const roleNavigation: Record<string, NavGroup[]> = {
  ADMIN: [
    {
      title: "Administration",
      items: [
        { title: "System Overview", href: "/dashboard/admin", icon: LayoutDashboard },
        { title: "Leave Approvals", href: "/dashboard/leaves/manage", icon: FileText },
        { title: "Employees", href: "/dashboard/admin/users", icon: Users },
        { title: "Departments", href: "/dashboard/departments", icon: Building2 },
        { title: "Roles & Permissions", href: "/dashboard/admin/roles", icon: KeyRound },
        { title: "Daily Attendance", href: "/dashboard/accountant/location-logs", icon: MapPin },
        { title: "Configuration", href: "/dashboard/admin/settings", icon: Settings },
      ]
    },
    {
      title: "General",
      items: [
        { title: "Notices", href: "/dashboard/announcements", icon: Megaphone },
        { title: "Policies", href: "/dashboard/policies", icon: BookOpen },
        { title: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
        { title: "Documents", href: "/dashboard/documents", icon: LibraryIcon },
        { title: "File Share", href: "/dashboard/file-share", icon: Share2 },
        { title: "Organization", href: "/dashboard/org-chart", icon: Users2 },
      ]
    },
    {
      title: "Accounting & Finance",
      items: [
        { title: "Payroll & Processing", href: "/dashboard/accountant", icon: Calculator },
      ]
    },
    {
      title: "Project Workspace",
      items: [
        { title: "Project Overview", href: "/dashboard/projects", icon: FolderKanban },
        { title: "Tasks", href: "/dashboard/projects/reports", icon: CheckSquare },
        { title: "Task Master", href: "/dashboard/projects/task-master", icon: ListChecks },
      ]
    }
  ],
  SYSTEM_ADMIN: [
    {
      title: "Administration",
      items: [
        { title: "System Overview", href: "/dashboard/admin", icon: LayoutDashboard },
        { title: "Leave Approvals", href: "/dashboard/leaves/manage", icon: FileText },
        { title: "Employees", href: "/dashboard/admin/users", icon: Users },
        { title: "Departments", href: "/dashboard/departments", icon: Building2 },
        { title: "Roles & Permissions", href: "/dashboard/admin/roles", icon: KeyRound },
        { title: "Daily Attendance", href: "/dashboard/accountant/location-logs", icon: MapPin },
        { title: "Configuration", href: "/dashboard/admin/settings", icon: Settings },
      ]
    },
    {
      title: "General",
      items: [
        { title: "Notices", href: "/dashboard/announcements", icon: Megaphone },
        { title: "Policies", href: "/dashboard/policies", icon: BookOpen },
        { title: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
        { title: "Documents", href: "/dashboard/documents", icon: LibraryIcon },
        { title: "File Share", href: "/dashboard/file-share", icon: Share2 },
        { title: "Organization", href: "/dashboard/org-chart", icon: Users2 },
      ]
    },
    {
      title: "Accounting & Finance",
      items: [
        { title: "Payroll & Processing", href: "/dashboard/accountant", icon: Calculator },
      ]
    },
    {
      title: "Project Workspace",
      items: [
        { title: "Project Overview", href: "/dashboard/projects", icon: FolderKanban },
        { title: "Tasks", href: "/dashboard/projects/reports", icon: CheckSquare },
        { title: "Task Master", href: "/dashboard/projects/task-master", icon: ListChecks },
      ]
    },
    {
      title: "Developer Tools",
      items: [
        { title: "Attendance Adjust", href: "/dashboard/admin/developer/attendance", icon: ShieldCheck },
        { title: "Attendance Backfill", href: "/dashboard/admin/developer/backfill", icon: CalendarPlus },
        { title: "Special Case Adjust", href: "/dashboard/admin/developer/special-case", icon: Sparkles },
        { title: "Leave Adjust", href: "/dashboard/admin/developer/leave-adjustment", icon: FileText },
        { title: "Activity Log", href: "/dashboard/projects/activity", icon: History },
      ]
    }
  ],
  ACCOUNTANT: [
    {
      title: "My Workspace",
      items: [
        { title: "My Space", href: "/dashboard/employee", icon: Home },
        { title: "My Attendance", href: "/dashboard/employee/attendance", icon: Activity },
        { title: "My Leaves", href: "/dashboard/employee/leaves", icon: FileText },
      ]
    },
    {
      title: "General",
      items: [
        { title: "Notices", href: "/dashboard/announcements", icon: Megaphone },
        { title: "Policies", href: "/dashboard/policies", icon: BookOpen },
        { title: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
        { title: "Documents", href: "/dashboard/documents", icon: LibraryIcon },
        { title: "File Share", href: "/dashboard/file-share", icon: Share2 },
        { title: "Organization", href: "/dashboard/org-chart", icon: Users2 },
      ]
    },
    {
      title: "Administration",
      items: [
        { title: "Employees", href: "/dashboard/accountant/users", icon: Users },
        { title: "Departments", href: "/dashboard/departments", icon: Building2 },
        { title: "Daily Attendance", href: "/dashboard/accountant/location-logs", icon: MapPin },
        { title: "Leave Approvals", href: "/dashboard/leaves/manage", icon: FileText },
        { title: "Configuration", href: "/dashboard/accountant/settings", icon: Settings },
      ]
    },
    {
      title: "Accounting & Finance",
      items: [
        { title: "Payroll & Processing", href: "/dashboard/accountant", icon: Calculator },
      ]
    },
    {
      title: "Project Workspace",
      items: [
        { title: "Project Overview", href: "/dashboard/projects", icon: FolderKanban },
        { title: "Tasks", href: "/dashboard/projects/reports", icon: CheckSquare },
        { title: "Task Master", href: "/dashboard/projects/task-master", icon: ListChecks },
      ]
    }
  ],
  HR: [
    {
      title: "My Workspace",
      items: [
        { title: "My Space", href: "/dashboard/employee", icon: Home },
        { title: "My Attendance", href: "/dashboard/employee/attendance", icon: Activity },
        { title: "My Leaves", href: "/dashboard/employee/leaves", icon: FileText },
      ]
    },
    {
      title: "General",
      items: [
        { title: "Notices", href: "/dashboard/announcements", icon: Megaphone },
        { title: "Policies", href: "/dashboard/policies", icon: BookOpen },
        { title: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
        { title: "Documents", href: "/dashboard/documents", icon: LibraryIcon },
        { title: "File Share", href: "/dashboard/file-share", icon: Share2 },
        { title: "Organization", href: "/dashboard/org-chart", icon: Users2 },
      ]
    },
    {
      title: "Administration",
      items: [
        { title: "Employees", href: "/dashboard/admin/users", icon: Users },
        { title: "Leave Approvals", href: "/dashboard/leaves/manage", icon: FileText },
        { title: "Daily Attendance", href: "/dashboard/accountant/location-logs", icon: MapPin },
        { title: "Departments", href: "/dashboard/departments", icon: Building2 },
        { title: "Reports", href: "/dashboard/admin/reports", icon: FileText },
        { title: "Organization", href: "/dashboard/admin/org-chart", icon: Users2 },
      ]
    },
    {
      title: "Project Workspace",
      items: [
        { title: "Project Overview", href: "/dashboard/projects", icon: FolderKanban },
        { title: "Tasks", href: "/dashboard/projects/reports", icon: CheckSquare },
      ]
    }
  ],
  EMPLOYEE: [
    {
      title: "My Workspace",
      items: [
        { title: "My Space", href: "/dashboard/employee", icon: Home },
        { title: "My Attendance", href: "/dashboard/employee/attendance", icon: Activity },
        { title: "My Leaves", href: "/dashboard/employee/leaves", icon: FileText },
      ]
    },
    {
      title: "General",
      items: [
        { title: "Notices", href: "/dashboard/announcements", icon: Megaphone },
        { title: "Policies", href: "/dashboard/policies", icon: BookOpen },
        { title: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
        { title: "Documents", href: "/dashboard/documents", icon: LibraryIcon },
        { title: "File Share", href: "/dashboard/file-share", icon: Share2 },
        { title: "Organization", href: "/dashboard/org-chart", icon: Users2 },
        { title: "Departments", href: "/dashboard/departments", icon: Building2 },
      ]
    },
    {
      title: "Project Workspace",
      items: [
        { title: "Project Overview", href: "/dashboard/projects", icon: FolderKanban },
        { title: "Tasks", href: "/dashboard/projects/reports", icon: CheckSquare },
      ]
    }
  ],
  EXTERNAL_USER: [
    {
      title: "My Workspace",
      items: [
        { title: "My Space", href: "/dashboard/external", icon: Home },
      ]
    },
    {
      title: "General",
      items: [
        { title: "Documents", href: "/dashboard/documents", icon: LibraryIcon },
      ]
    },
    {
      title: "Project Workspace",
      items: [
        { title: "Project Overview", href: "/dashboard/projects", icon: FolderKanban },
        { title: "Tasks", href: "/dashboard/projects/reports", icon: CheckSquare },
      ]
    }
  ]
};

export function getNavigationRegistry(isAdmin: boolean): NavGroup[] {
  return AVAILABLE_MENUS.map((g) => {
    let items = g.items.map((i) => ({
      title:
        i.path === "/dashboard/employee" || i.path === "/dashboard/external"
          ? "My Space"
          : i.title,
      href: i.path,
      icon: i.icon,
    }));

    if (g.group === "General") {
      if (!isAdmin) {
        // Non-admin: Departments belongs in General
        if (!items.some((i) => i.href === "/dashboard/departments")) {
          items.push({
            title: "Departments",
            href: "/dashboard/departments",
            icon: Building2,
          });
        }
      } else {
        // Admin: Departments belongs in Administration, remove from General
        items = items.filter((i) => i.href !== "/dashboard/departments");
      }
    } else if (g.group === "Administration") {
      if (isAdmin) {
        // Admin: Ensure Departments is in Administration
        if (!items.some((i) => i.href === "/dashboard/departments")) {
          const empIndex = items.findIndex((i) => i.href === "/dashboard/admin/users");
          const deptItem = {
            title: "Departments",
            href: "/dashboard/departments",
            icon: Building2,
          };
          if (empIndex !== -1) {
            items.splice(empIndex + 1, 0, deptItem);
          } else {
            items.push(deptItem);
          }
        }
      } else {
        // Non-admin: Remove Departments from Administration
        items = items.filter((i) => i.href !== "/dashboard/departments");
      }
    }

    return {
      title: g.group,
      items,
    };
  });
}

export function getNavigationForUser({
  userRole,
  isTeamLeader = false,
  userAllowedMenus,
  isExternal: isExternalProp
}: {
  userRole: string;
  isTeamLeader?: boolean;
  userAllowedMenus?: string[];
  isExternal?: boolean;
}): NavGroup[] {
  const isAdmin = userRole === "ADMIN" || userRole === "SYSTEM_ADMIN";
  const isExternal = isExternalProp ?? isExternalUser({ role: userRole });

  // If user has full access ("all")
  if (userAllowedMenus && userAllowedMenus.includes("all")) {
    const rawGroups = roleNavigation[userRole] || roleNavigation.ADMIN;
    if (isExternal) {
      return rawGroups.map(group => ({
        ...group,
        items: group.items.filter(item => item.href !== "/dashboard/projects" && !item.href.startsWith("/dashboard/projects/activity") && !item.href.startsWith("/dashboard/projects/task-master"))
      })).filter(g => g.items.length > 0);
    }
    return rawGroups;
  }

  // If user has explicit allowedMenus configured
  if (userAllowedMenus && Array.isArray(userAllowedMenus)) {
    const allowedSet = new Set(userAllowedMenus);

    if (allowedSet.size === 0) {
      return [];
    }

    // Standard sequence:
    // Admin: Administration -> General -> Accounting & Finance -> Project Workspace (No "My Workspace")
    // Non-Admin: My Workspace -> General -> Administration -> Accounting & Finance -> Project Workspace
    const groupOrder = isAdmin
      ? ["Administration", "General", "Accounting & Finance", "Project Workspace"]
      : ["My Workspace", "General", "Administration", "Accounting & Finance", "Project Workspace"];

    const registry = getNavigationRegistry(isAdmin);
    const seenHrefs = new Set<string>();
    const groups: NavGroup[] = [];

    for (const groupTitle of groupOrder) {
      const registryGroup = registry.find(g => g.title === groupTitle);
      if (!registryGroup) continue;

      const visibleItems = registryGroup.items.filter(item => {
        if (isExternal && (item.href.startsWith("/dashboard/projects/activity") || item.href.startsWith("/dashboard/projects/task-master"))) {
          return false;
        }

        const hasAccess = allowedSet.has("all") || allowedSet.has(item.href);

        if (!hasAccess) return false;
        // Avoid duplicate hrefs across different groups
        if (seenHrefs.has(item.href)) return false;
        seenHrefs.add(item.href);
        return true;
      });

      if (visibleItems.length > 0) {
        groups.push({
          title: registryGroup.title,
          items: visibleItems
        });
      }
    }

    return groups;
  }

  // Fallback to role navigation template
  if (isExternal) {
    return roleNavigation.EXTERNAL_USER;
  }
  return roleNavigation[userRole] || roleNavigation.EMPLOYEE;
}
