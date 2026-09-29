"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react";
import { useDesktopNotification } from "@/hooks/use-desktop-notification";
import { useWebPushSubscription } from "@/hooks/use-web-push-subscription";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getNotifications, markAsRead, markAllAsRead } from "@/actions/notification";
import { cn, stripHtml } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export function NotificationNav() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { permission, requestPermission, sendNotification } = useDesktopNotification();
  const { subscribe, isSubscribing } = useWebPushSubscription();
  const shownNotificationIds = useRef<Set<string>>(new Set());

  const processNotifications = (newNotifications: any[], isInitialLoad = false) => {
    const livePermission = typeof window !== "undefined" ? (window as any).Notification?.permission : "default";

    // 1. Process standard notifications
    newNotifications.forEach((n: any) => {
      if (!n.isRead && !shownNotificationIds.current.has(n.id)) {
        if (!isInitialLoad) {
          // If desktop permission is granted, push OS notification (which also triggers device vibration)
          if (livePermission === "granted") {
            sendNotification(n.title, {
              body: n.content,
              tag: n.id,
              data: { link: n.link },
              onClick: () => {
                if (n.link) router.push(n.link);
              },
            });
          } else {
            // Fallback: Trigger haptic vibration directly inside active browser console
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
          }

          // Always show a gorgeous, premium in-app slide-in toast
          toast(n.title, {
            description: stripHtml(n.content),
            action: n.link ? {
              label: "View",
              onClick: () => router.push(n.link)
            } : undefined,
            duration: 5000,
          });
        }

        shownNotificationIds.current.add(n.id);
      }
    });

    newNotifications.forEach((n: any) => shownNotificationIds.current.add(n.id));
    setNotifications(newNotifications);
    setUnreadCount(newNotifications.filter((n: any) => !n.isRead).length);
  };

  const fetchNotifications = async () => {
    const result = await getNotifications(10);
    if (result.success && result.data) {
      processNotifications(result.data, true);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const sse = new EventSource("/api/notifications/sse");

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "update") {
          processNotifications(payload.data);
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    sse.addEventListener("auth_error", () => {
      console.warn("SSE Auth Error - Closing connection to prevent loop");
      sse.close();
    });

    return () => sse.close();
  }, []);

  // Auto-subscribe to push if permission is already granted
  useEffect(() => {
    if (permission === "granted") {
      subscribe();
    }
  }, [permission, subscribe]);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    fetchNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-rose-500" />;
      default:
        return <Info className="h-4 w-4 text-sky-500" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground relative rounded-sm group transition-all"
        >
          <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 border-2 border-background rounded-full animate-pulse"></span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-32px)] p-0 animate-scale-in shadow-2xl border-border/60"
        collisionPadding={16}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <DropdownMenuLabel className="p-0 font-bold text-sm">Notifications</DropdownMenuLabel>
            {permission === "denied" && (
              <span className="text-[9px] text-rose-500 font-bold uppercase">(Blocked)</span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-transparent"
              onClick={(e) => {
                e.preventDefault();
                handleMarkAllRead();
              }}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {permission === "default" && (
          <div className="mx-4 my-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 bg-primary/10 p-1.5 rounded-sm">
                <Bell className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-bold leading-tight text-foreground">
                  Enable Desktop Notifications
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Get real-time alerts for leave approvals and system updates.
                </p>
                <Button
                  size="sm"
                  className="h-7 w-full text-[10px] uppercase font-black tracking-widest mt-2 bg-primary hover:bg-primary/90"
                  disabled={isSubscribing}
                  onClick={async (e) => {
                    e.preventDefault();
                    const result = await requestPermission();
                    if (result === "granted") {
                      await subscribe();
                      fetchNotifications();
                    }
                  }}
                >
                  {isSubscribing ? "Setting up..." : "Enable Now"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
          {notifications.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center gap-2 opacity-30">
              <Bell className="h-8 w-8" />
              <p className="text-[10px] font-black uppercase tracking-widest">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "p-4 border-b border-border/20 last:border-0 cursor-pointer focus:bg-accent/50",
                  !n.isRead && "bg-primary/3"
                )}
                onSelect={(e) => {
                  if (!n.isRead) {
                    handleMarkAsRead(n.id);
                  }
                  if (n.link) {
                    router.push(n.link);
                  }
                }}
              >
                <div className="flex gap-3 w-full">
                  <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <p className={cn("text-xs font-bold leading-none", !n.isRead ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </p>
                      {!n.isRead && <div className="size-1.5 rounded-full bg-primary mt-1 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-ordered line-clamp-2">
                      {stripHtml(n.content)}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] font-bold text-muted-foreground/50 uppercase">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                      {(() => {
                        const genericLandings = [
                          "/dashboard",
                          "/dashboard/",
                          "/dashboard/employee",
                          "/dashboard/employee/",
                          "/dashboard/manager",
                          "/dashboard/manager/",
                          "/dashboard/accountant",
                          "/dashboard/accountant/",
                          "/dashboard/admin",
                          "/dashboard/admin/",
                        ];
                        const isNecessary = n.link && !genericLandings.includes(n.link.trim());
                        return isNecessary ? (
                          <span
                            className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!n.isRead) {
                                handleMarkAsRead(n.id);
                              }
                              router.push(n.link);
                            }}
                          >
                            View Details
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between gap-4">
          <DropdownMenuItem asChild className="p-0 focus:bg-transparent cursor-pointer border-0">
            <Link
              href="/dashboard/notifications"
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1.5"
            >
              View All Notifications
            </Link>
          </DropdownMenuItem>
          <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
            Last 10 items
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
