"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Trash2,
  CheckCheck,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Info,
  User as UserIcon,
  ShieldCheck,
  Search,
  Copy,
  Building2,
  Sparkles,
  Loader2,
  Eye,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAnnouncements,
  deleteAnnouncement,
  getAllAnnouncementsForAdmin,
  markAnnouncementAsRead,
  markAllAnnouncementsAsRead,
} from "@/actions/announcement";
import { cn, getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui";
import { CreateAnnouncementDialog } from "./create-announcement-dialog";
import { getDepartments } from "@/actions/department";

interface AnnouncementListProps {
  userRole?: string;
  departmentId?: string | null;
  departments?: { id: string; name: string }[];
  canCreate?: boolean;
}

export function AnnouncementList({
  userRole,
  departmentId,
  departments: initialDepartments,
  canCreate: explicitCanCreate,
}: AnnouncementListProps) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>(
    initialDepartments || []
  );

  const isAdmin =
    explicitCanCreate ??
    (userRole === "ADMIN" || userRole === "SYSTEM_ADMIN" || userRole === "ACCOUNTANT");

  useEffect(() => {
    if (isAdmin && (!departments || departments.length === 0)) {
      getDepartments().then((res) => {
        if (res.success && res.departments) {
          setDepartments(res.departments);
        }
      });
    }
  }, [isAdmin, departments]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      let result;
      if (isAdmin) {
        result = await getAllAnnouncementsForAdmin();
      } else {
        result = await getAnnouncements(departmentId || undefined);
      }

      if (result.success && result.data) {
        setAnnouncements(result.data);
      }
    } catch (err) {
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
    await markAnnouncementAsRead(id);
    toast.success("Notice marked as read");
  };

  const handleMarkAllRead = async () => {
    const unreadIds = announcements.filter((a) => !a.isRead).map((a) => a.id);
    if (unreadIds.length === 0) return;

    setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
    await markAllAnnouncementsAsRead(unreadIds);
    toast.success("All notices marked as read");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this notice?")) {
      const res = await deleteAnnouncement(id);
      if (res.success) {
        toast.success("Notice deleted");
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      } else {
        toast.error(res.error || "Failed to delete notice");
      }
    }
  };

  const handleCopyNotice = (notice: any) => {
    const text = `${notice.title}\n\n${notice.content.replace(/<[^>]*>/g, "")}`;
    navigator.clipboard.writeText(text);
    toast.success("Notice text copied to clipboard");
  };

  const getPriorityTheme = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return {
          badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
          dot: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse",
          cardBorder: "border-rose-500/30 hover:border-rose-500/60",
          icon: AlertCircle,
          label: "Critical Notice",
        };
      case "WARNING":
        return {
          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
          dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
          cardBorder: "border-amber-500/30 hover:border-amber-500/60",
          icon: AlertTriangle,
          label: "Important Update",
        };
      case "INFO":
      default:
        return {
          badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
          dot: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]",
          cardBorder: "border-border/80 hover:border-primary/50",
          icon: Info,
          label: "General Notice",
        };
    }
  };

  // Filter calculations
  const unreadCount = announcements.filter((a) => !a.isRead).length;
  const criticalCount = announcements.filter((a) => a.priority === "CRITICAL").length;
  const warningCount = announcements.filter((a) => a.priority === "WARNING").length;

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      const searchStr = search.toLowerCase().trim();
      const matchesSearch =
        !searchStr ||
        a.title?.toLowerCase().includes(searchStr) ||
        a.content?.toLowerCase().includes(searchStr) ||
        a.author?.name?.toLowerCase().includes(searchStr) ||
        a.targetDepartment?.name?.toLowerCase().includes(searchStr);

      if (!matchesSearch) return false;

      if (priorityFilter === "UNREAD") return !a.isRead;
      if (priorityFilter === "CRITICAL") return a.priority === "CRITICAL";
      if (priorityFilter === "WARNING") return a.priority === "WARNING";
      if (priorityFilter === "INFO") return a.priority === "INFO";

      return true;
    });
  }, [announcements, search, priorityFilter]);

  return (
    <div className="space-y-6">
      {/* ── 1. TOOLBAR & FILTER BAR ──────────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-md p-4 lg:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Priority & Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            <button
              type="button"
              onClick={() => setPriorityFilter("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border",
                priorityFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              All Notices ({announcements.length})
            </button>

            <button
              type="button"
              onClick={() => setPriorityFilter("UNREAD")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                priorityFilter === "UNREAD"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    priorityFilter === "UNREAD"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary/15 text-primary"
                  )}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => setPriorityFilter("CRITICAL")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                  priorityFilter === "CRITICAL"
                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border-rose-500/30"
                )}
              >
                <span>Critical</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-rose-500/20">
                  {criticalCount}
                </span>
              </button>
            )}

            {warningCount > 0 && (
              <button
                type="button"
                onClick={() => setPriorityFilter("WARNING")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                  priorityFilter === "WARNING"
                    ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30"
                )}
              >
                <span>Warnings</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-amber-500/20">
                  {warningCount}
                </span>
              </button>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="h-9 text-xs font-semibold rounded-md border-border/80 hover:bg-primary/5 hover:text-primary gap-1.5 cursor-pointer shrink-0"
            >
              <CheckCheck className="size-4" />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Read all</span>
            </Button>
            {isAdmin && (
              <div className="md:hidden">
                <CreateAnnouncementDialog departments={departments} />
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <Input
            placeholder="Search notices by title, keywords, department, or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10 pr-4 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── 2. NOTICES LIST ──────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card border border-border/80 rounded-md">
          <Loader2 className="size-8 text-primary animate-spin mb-3" />
          <p className="text-xs text-muted-foreground font-medium">Loading company broadcasts...</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-md bg-card/60 text-center px-6 space-y-3">
          <div className="p-3.5 rounded-md bg-muted/60 text-muted-foreground border border-border/60">
            <Megaphone className="size-8 opacity-40" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">No notices found</h3>
            <p className="text-xs text-muted-foreground">
              {search
                ? `No notices matched your search query "${search}".`
                : "There are currently no active announcements in this section."}
            </p>
          </div>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setPriorityFilter("ALL");
              }}
              className="text-xs rounded-md h-8 mt-2"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((a) => {
            const isRead = a.isRead;
            const theme = getPriorityTheme(a.priority);
            const Icon = theme.icon;
            const authorName = a.author?.name || "Administration";

            return (
              <div
                key={a.id}
                className={cn(
                  "p-4 sm:p-6 rounded-md border bg-card shadow-2xs transition-all duration-200 flex flex-col space-y-3.5 sm:space-y-4 relative group",
                  theme.cardBorder,
                  !isRead && "bg-primary/[0.02] ring-1 ring-primary/20"
                )}
              >
                {/* Header Row: Badges & Action Toolbar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    {/* Priority Badge */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border shrink-0",
                        theme.badge
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span>{theme.label}</span>
                    </div>

                    {/* Audience Badge */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground text-[11px] font-medium border border-border/60 shrink-0">
                      <Building2 className="size-3 shrink-0" />
                      <span>
                        {a.targetDepartment ? `Dept: ${a.targetDepartment.name}` : "Company Wide"}
                      </span>
                    </div>

                    {/* Unread Glow Badge */}
                    {!isRead && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full shrink-0">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        <span>New</span>
                      </span>
                    )}
                  </div>

                  {/* Top Action Toolbar */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyNotice(a)}
                      className="h-8 px-2 sm:px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-md gap-1.5 cursor-pointer"
                      title="Copy Notice text"
                    >
                      <Copy className="size-3.5" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>

                    {!isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(a.id)}
                        className="h-8 px-2 sm:px-2.5 text-xs text-primary hover:bg-primary/10 rounded-md gap-1.5 cursor-pointer font-semibold"
                        title="Mark as Read"
                      >
                        <Check className="size-3.5" />
                        <span className="hidden sm:inline">Mark read</span>
                      </Button>
                    )}

                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(a.id)}
                        className="size-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                        title="Delete Notice (System-Wide)"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <h3
                    className={cn(
                      "text-sm sm:text-base font-bold tracking-tight text-foreground",
                      !isRead ? "text-foreground" : "text-foreground/90"
                    )}
                  >
                    {a.title}
                  </h3>
                </div>

                {/* Rich Content Body */}
                <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed font-normal bg-background/50 p-3.5 sm:p-4 rounded-md border border-border/60">
                  <RichTextViewer
                    content={a.content}
                    className="[&_p]:mb-2.5 [&_p]:last:mb-0 [&_strong]:text-foreground [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 font-normal text-xs sm:text-sm"
                  />
                </div>

                {/* Footer Metadata */}
                <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="size-7 rounded-full border border-border/70 shrink-0">
                      <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">
                        {getInitials(authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
                      <span className="font-semibold text-xs text-foreground/90 truncate">{authorName}</span>
                      <span className="hidden sm:inline text-muted-foreground/40">&bull;</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                        <Calendar className="size-3 text-muted-foreground/70 shrink-0" />
                        <span>{format(new Date(a.createdAt), "MMM dd, yyyy • h:mm a")}</span>
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md w-fit flex items-center gap-1 shrink-0 self-start sm:self-auto">
                      <ShieldCheck className="size-3 shrink-0" />
                      <span>Admin Broadcast</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
