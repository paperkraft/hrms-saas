"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  Trash2,
  CheckCheck,
  Calendar,
  ExternalLink,
  Sparkles,
  Loader2,
  Search,
  Check,
  Clock,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  triggerManualNotificationCleanup,
} from "@/actions/notification";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function NotificationList() {
  const { data: session } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SYSTEM_ADMIN";

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const result = await getNotifications();
      if (result.success && result.data) {
        setNotifications(result.data);
      }
    } catch (err) {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handlePurgePastBroadcasts = async () => {
    setIsPurging(true);
    const result = await triggerManualNotificationCleanup();
    setIsPurging(false);
    if (result.success && result.stats) {
      toast.success(
        `Purged ${result.stats.total} stale notification${result.stats.total === 1 ? "" : "s"} (${result.stats.celebrations} celebrations, ${result.stats.announcements} announcements, ${result.stats.reminders} reminders, ${result.stats.leaves || 0} leaves, ${result.stats.activity || 0} tasks/overtime/allowances)`
      );
      fetchNotifications();
    } else {
      toast.error(result.error || "Failed to purge notifications");
    }
  };

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    await markAsRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllAsRead();
    toast.success("All notifications marked as read");
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id);
    toast.success("Notification deleted");
  };

  const handleClearAll = async () => {
    setNotifications([]);
    await clearAllNotifications();
    toast.success("All notifications cleared");
  };

  const getNotificationTheme = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return {
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
          iconBg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
          icon: CheckCircle2,
          label: "Success",
        };
      case "WARNING":
        return {
          badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
          iconBg: "bg-amber-500/10 text-amber-600 border-amber-500/20",
          icon: AlertTriangle,
          label: "Alert",
        };
      case "ERROR":
        return {
          badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
          iconBg: "bg-rose-500/10 text-rose-600 border-rose-500/20",
          icon: XCircle,
          label: "Action Required",
        };
      case "INFO":
      default:
        return {
          badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
          iconBg: "bg-sky-500/10 text-sky-600 border-sky-500/20",
          icon: Info,
          label: "Info",
        };
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const searchStr = search.toLowerCase().trim();
      const matchesSearch =
        !searchStr ||
        n.title?.toLowerCase().includes(searchStr) ||
        n.content?.toLowerCase().includes(searchStr);

      if (!matchesSearch) return false;

      if (typeFilter === "UNREAD") return !n.isRead;
      if (typeFilter === "WARNING") return n.type === "WARNING" || n.type === "ERROR";
      if (typeFilter === "SUCCESS") return n.type === "SUCCESS";
      if (typeFilter === "INFO") return n.type === "INFO";

      return true;
    });
  }, [notifications, search, typeFilter]);

  return (
    <div className="space-y-4">
      {/* ── TOOLBAR & FILTERS ─────────────────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-xl p-4 lg:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status & Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            <button
              type="button"
              onClick={() => setTypeFilter("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border",
                typeFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              All ({notifications.length})
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("UNREAD")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                typeFilter === "UNREAD"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    typeFilter === "UNREAD"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-primary/15 text-primary"
                  )}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("WARNING")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                typeFilter === "WARNING"
                  ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30"
              )}
            >
              <span>Alerts</span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("SUCCESS")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                typeFilter === "SUCCESS"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30"
              )}
            >
              <span>Success</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="h-8 text-xs font-semibold rounded-lg border-border/80 hover:bg-primary/5 hover:text-primary gap-1.5 cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              <span>Mark all read</span>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={notifications.length === 0}
                  className="h-8 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg border-rose-500/30 gap-1.5 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>Clear</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Notifications?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your notifications from your activity log.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-lg text-xs">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-xs font-semibold"
                  >
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPurging}
                    className="h-8 text-xs font-semibold text-amber-600 hover:bg-amber-500/10 border-amber-500/30 rounded-lg gap-1.5 cursor-pointer"
                  >
                    {isPurging ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-amber-500" />
                    )}
                    <span>{isPurging ? "Purging..." : "Purge Broadcasts"}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <Sparkles className="size-4.5 text-amber-500" />
                      Purge Stale Broadcasts?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-xs text-muted-foreground pt-1">
                        <p>This will remove expired notifications system-wide for all users:</p>
                        <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                          <li>Celebrations & work anniversaries older than 7 days</li>
                          <li>Check-in / Check-out reminders older than 24 hours</li>
                          <li>Expired announcement notices older than 14 days</li>
                          <li>Task reviews, comments, and leave alerts older than 30 days</li>
                        </ul>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg text-xs">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handlePurgePastBroadcasts}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Confirm Purge
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search notification history by title, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9.5 pl-9.5 pr-4 text-xs bg-background border-border/80 rounded-lg focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── NOTIFICATIONS FEED ────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border/80 rounded-xl">
          <Loader2 className="size-7 text-primary animate-spin mb-2.5" />
          <p className="text-xs text-muted-foreground font-medium">Loading alerts & notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl bg-card/60 text-center px-6 space-y-3">
          <div className="p-3 rounded-xl bg-muted/60 text-muted-foreground border border-border/60">
            <Bell className="size-7 opacity-40" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">No notifications found</h3>
            <p className="text-xs text-muted-foreground">
              {search
                ? `No alerts matched your search query "${search}".`
                : "You are all caught up! No active notifications at this time."}
            </p>
          </div>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setTypeFilter("ALL");
              }}
              className="text-xs rounded-lg h-8 mt-1"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((n) => {
            const isRead = n.isRead;
            const theme = getNotificationTheme(n.type);
            const Icon = theme.icon;

            return (
              <div
                key={n.id}
                className={cn(
                  "p-4 sm:p-5 rounded-xl border bg-card shadow-2xs transition-all duration-200 flex flex-col sm:flex-row items-start justify-between gap-4 group",
                  !isRead
                    ? "border-primary/40 bg-primary/[0.02] ring-1 ring-primary/20"
                    : "border-border/80 hover:border-primary/30"
                )}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Icon */}
                  <div className={cn("p-2 rounded-lg border shrink-0 mt-0.5", theme.iconBg)}>
                    <Icon className="size-4" />
                  </div>

                  {/* Body Details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={cn(
                          "text-sm font-bold tracking-tight",
                          !isRead ? "text-foreground" : "text-foreground/90"
                        )}
                      >
                        {n.title}
                      </h4>

                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border",
                          theme.badge
                        )}
                      >
                        {theme.label}
                      </span>

                      {!isRead && (
                        <span className="size-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                      {n.content}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground/70">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="size-3" />
                        <span>{format(new Date(n.createdAt), "PPP • p")}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                  {n.link && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleMarkAsRead(n.id);
                        router.push(n.link);
                      }}
                      className="h-8 px-2.5 text-xs text-primary hover:bg-primary/10 rounded-lg gap-1.5 font-semibold cursor-pointer"
                    >
                      <span>View</span>
                      <ExternalLink className="size-3" />
                    </Button>
                  )}

                  {!isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMarkAsRead(n.id)}
                      className="size-8 text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                      title="Mark as Read"
                    >
                      <Check className="size-3.5" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(n.id)}
                    className="size-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Delete Notification"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
