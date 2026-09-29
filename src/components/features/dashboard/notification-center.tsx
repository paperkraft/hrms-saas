"use client";

import { Bell, CheckCircle2, AlertCircle, Info, ArrowRight } from "lucide-react";
import { cn, stripHtml } from "@/lib/utils";
import { markAllAsRead } from "@/actions/notification";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Notification {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  type: string;
  isRead: boolean;
  link?: string;
}

interface NotificationCenterProps {
  notifications: any[];
  className?: string;
  hideHeader?: boolean;
}

export function NotificationCenter({ notifications: initialNotifications, className, hideHeader }: NotificationCenterProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = (initialNotifications || []).map((n) => ({
    ...n,
    createdAt: new Date(n.createdAt),
  })) as Notification[];

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNotificationClick = (notif: Notification) => {
    if (notif.title.toLowerCase().includes("announcement")) {
      router.push("/dashboard/announcements");
    } else if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className={cn("bg-card border border-border/80 rounded-md flex flex-col h-full overflow-hidden", className)}>
      {!hideHeader && (
        <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Notifications</h3>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Feed</p>
          </div>
          <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center relative">
            <Bell className="size-4" />
            {unreadCount > 0 && <div className="absolute -top-0.5 -right-0.5 size-2 bg-rose-500 rounded-full border border-card animate-pulse" />}
          </div>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto divide-y divide-border/40", hideHeader && "-mx-1")}>
        {notifications.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bell className="size-6 opacity-40" />
            <p className="text-xs font-semibold">All caught up! No new notifications.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={cn(
                "p-3 flex items-start gap-3 hover:bg-muted/30 transition-all rounded-md cursor-pointer group",
                !notif.isRead && "bg-primary/5"
              )}
            >
              <div
                className={cn(
                  "size-8 rounded-md p-1.5 shrink-0 border flex items-center justify-center transition-colors",
                  notif.type === "SUCCESS" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                  notif.type === "WARNING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  notif.type === "INFO" && "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
                  notif.type === "ERROR" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                )}
              >
                {notif.type === "SUCCESS" && <CheckCircle2 className="size-4" />}
                {notif.type === "WARNING" && <AlertCircle className="size-4" />}
                {notif.type === "INFO" && <Info className="size-4" />}
                {notif.type === "ERROR" && <ArrowRight className="size-4 rotate-45" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {notif.title}
                  </p>
                  {!notif.isRead && <div className="size-1.5 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug pr-2 mt-0.5 line-clamp-2" title={stripHtml(notif.content)}>
                  {stripHtml(notif.content)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {mounted ? formatDistanceToNow(notif.createdAt, { addSuffix: true }) : "..."}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {unreadCount > 0 && (
        <div className="p-2 border-t border-border/70 bg-card">
          <button
            onClick={() => markAllAsRead()}
            className="w-full py-1.5 rounded-md flex items-center justify-center text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-all cursor-pointer"
          >
            Mark All as Read
          </button>
        </div>
      )}
    </div>
  );
}
