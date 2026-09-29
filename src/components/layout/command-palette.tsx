"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { signOut } from "next-auth/react"
import {
  Search,
  Home,
  User,
  Activity,
  FileText,
  FolderKanban,
  GitFork,
  CheckCircle2,
  TrendingUp,
  Users,
  Settings,
  Sun,
  Moon,
  LogOut,
  Bell,
  BookOpen
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CommandItem {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  action?: () => void
  href?: string
  roles?: string[]
}

export function CommandPalette({ userRole, userAllowedMenus }: { userRole: string; userAllowedMenus?: string[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const modalRef = useRef<HTMLDivElement>(null)

  // Toggle Command Palette with Ctrl+K / Cmd+K or Custom Event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    const handleOpenCommandPalette = () => {
      setIsOpen(true)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("open-command-palette", handleOpenCommandPalette)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("open-command-palette", handleOpenCommandPalette)
    }
  }, [])

  // Auto-focus input when opened
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setActiveIndex(0)
      setSearch("")
    }
  }, [isOpen])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: "home-emp",
        title: "Dashboard",
        description: "View daily check-ins, punch-card and leave balances",
        icon: Home,
        href: "/dashboard/employee",
        roles: ["EMPLOYEE", "ACCOUNTANT"]
      },
      {
        id: "home-admin",
        title: "Home Overview",
        description: "View operational visibility and direct workforce status",
        icon: Home,
        href: "/dashboard/admin",
        roles: ["ADMIN", "SYSTEM_ADMIN"]
      },
      {
        id: "profile",
        title: "My Profile Details",
        description: "Update personal records, emergency contacts, and photo",
        icon: User,
        href: "/dashboard/profile"
      },
      {
        id: "attendance",
        title: "Attendance History",
        description: "Track check-in logs, geofencing reports, and late punch counts",
        icon: Activity,
        href: "/dashboard/employee/attendance",
        roles: ["EMPLOYEE", "ACCOUNTANT"]
      },
      {
        id: "leaves-emp",
        title: "Leave Management",
        description: "Apply for leaves, view balance tracking, and status logs",
        icon: FileText,
        href: "/dashboard/employee/leaves",
        roles: ["EMPLOYEE", "ACCOUNTANT"]
      },
      {
        id: "projects",
        title: "Project Board",
        description: "Manage client projects, view Gantt timelines, and edit tasks",
        icon: FolderKanban,
        href: "/dashboard/projects"
      },
      {
        id: "master-task-report",
        title: "My Tasks",
        description: "Analyze system-wide project tasks, timelines, and completion rates",
        icon: CheckCircle2,
        href: "/dashboard/projects/reports"
      },
      {
        id: "announcements",
        title: "Announcements Board",
        description: "View company broad-casts, critical bulletins, and peer updates",
        icon: Bell,
        href: "/dashboard/announcements"
      },
      {
        id: "policies",
        title: "Policies Vault",
        description: "Search corporate regulations, target lists, and signoff checks",
        icon: BookOpen,
        href: "/dashboard/policies"
      },
      // Admin Items
      {
        id: "org-chart",
        title: "Organization Chart",
        description: "Explore manager hierarchies with high-density zoom layouts",
        icon: GitFork,
        href: "/dashboard/admin/org-chart",
        roles: ["ADMIN", "SYSTEM_ADMIN"]
      },
      {
        id: "leave-inbox",
        title: "Leave Approval Inbox",
        description: "Review pending employee leave requests and process decisions",
        icon: CheckCircle2,
        href: "/dashboard/leaves/manage",
        roles: ["ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"]
      },
      {
        id: "reports",
        title: "Reports & Analytics Dashboard",
        description: "Analyze latency trends, leave categories, and task metrics",
        icon: TrendingUp,
        href: "/dashboard/admin/reports",
        roles: ["ADMIN", "SYSTEM_ADMIN"]
      },
      {
        id: "users",
        title: "User Account Management",
        description: "Create, invite, edit, or deactivate employee system accounts",
        icon: Users,
        href: "/dashboard/admin/users",
        roles: ["ADMIN", "SYSTEM_ADMIN"]
      },
      {
        id: "settings",
        title: "Global Office Settings",
        description: "Configure locations, holiday schedules, and office grace intervals",
        icon: Settings,
        href: "/dashboard/admin/settings",
        roles: ["ADMIN", "SYSTEM_ADMIN"]
      },
      // Accountant Items
      {
        id: "payroll",
        title: "Payroll & Allowances Management",
        description: "Approve allowance lists, leave-pay metrics, and export data",
        icon: TrendingUp,
        href: "/dashboard/accountant",
        roles: ["ACCOUNTANT"]
      },
      {
        id: "logout",
        title: "System Sign Out",
        description: "Safely close your current workspace session and lock console",
        icon: LogOut,
        action: () => signOut()
      }
    ]

    return items.filter((item) => {
      const href = item.href
      if (!href) return true
      if (userAllowedMenus && userAllowedMenus.includes("all")) return true
      if (userAllowedMenus && Array.isArray(userAllowedMenus)) {
        return userAllowedMenus.includes(href)
      }
      if (item.roles && !item.roles.includes(userRole)) return false
      return true
    })
  }, [userRole, userAllowedMenus, theme, setTheme])

  // Filter based on search query
  const filteredItems = useMemo(() => {
    if (!search) return commandItems
    const searchLower = search.toLowerCase()
    return commandItems.filter(
      (item) =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
    )
  }, [commandItems, search])

  // Keyboard navigation inside Command Palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % filteredItems.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredItems[activeIndex]) {
        executeItem(filteredItems[activeIndex])
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const executeItem = (item: CommandItem) => {
    setIsOpen(false)
    if (item.action) {
      item.action()
    } else if (item.href) {
      router.push(item.href)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-[5vh] sm:pt-[15vh] px-4 bg-background/40 backdrop-blur-xs select-none">
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-card/95 border border-border/80 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[60vh] animate-fade-in-up"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 border-b border-border/40 h-12 relative shrink-0">
          <Search className="size-4 text-muted-foreground/60 shrink-0" />
          <input
            ref={inputRef}
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setActiveIndex(0)
            }}
            className="flex-1 bg-transparent border-none outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 h-full font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 h-5 px-1.5 rounded-sm bg-muted text-[8px] font-black uppercase text-muted-foreground/60 border border-border/40 select-none">
            ESC
          </kbd>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = idx === activeIndex
              return (
                <div
                  key={item.id}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex items-center gap-3.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all select-none",
                    isSelected
                      ? "bg-primary/5 text-primary border-l-2 border-primary pl-2.5"
                      : "text-foreground hover:bg-muted/30 hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "size-8 rounded-md flex items-center justify-center border shrink-0 transition-colors",
                      isSelected
                        ? "bg-primary/10 border-primary/20 text-primary"
                        : "bg-muted/40 border-border/40 text-muted-foreground/60"
                    )}
                  >
                    <item.icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn("text-xs font-bold truncate", isSelected ? "text-primary" : "text-foreground")}>
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5 leading-none">
                      {item.description}
                    </p>
                  </div>
                  {isSelected && (
                    <kbd className="hidden sm:inline-flex items-center justify-center size-5 rounded-sm bg-primary/10 text-primary border border-primary/20 text-[9px] font-black shrink-0">
                      ↵
                    </kbd>
                  )}
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
              <Search className="size-6 text-muted-foreground mb-2.5" />
              <p className="text-xs font-bold text-foreground">No commands matched</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                Check query spelling
              </p>
            </div>
          )}
        </div>

        {/* Footer shortcuts helper info bar */}
        <div className="px-4 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-muted-foreground/50 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded-sm bg-muted border border-border/40 text-[7px]">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded-sm bg-muted border border-border/40 text-[7px]">↵</kbd> Select
            </span>
          </div>
          <span>Press <kbd className="px-1 rounded-sm bg-muted border border-border/40 text-[7px]">Ctrl</kbd> + <kbd className="px-1 rounded-sm bg-muted border border-border/40 text-[7px]">K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  )
}
