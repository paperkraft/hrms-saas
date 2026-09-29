import { Megaphone, AlertCircle, AlertTriangle, Info, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn, stripHtml } from "@/lib/utils";
import { AnnouncementPriority } from "@prisma/client";
import { useRouter } from "next/navigation";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  createdAt: Date;
  targetDepartment?: { name: string } | null;
}

interface AnnouncementWidgetProps {
  announcements: Announcement[];
  role?: string;
  className?: string;
  hideHeader?: boolean;
}

export function AnnouncementWidget({ announcements: initialAnnouncements, role, className, hideHeader }: AnnouncementWidgetProps) {
  const router = useRouter();
  const announcements = initialAnnouncements.map((a) => ({ ...a, createdAt: new Date(a.createdAt) }));

  const priorityColors: Record<AnnouncementPriority, string> = {
    INFO: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
    WARNING: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    CRITICAL: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  const handleItemClick = () => {
    router.push("/dashboard/announcements");
  };

  const PriorityIcon = ({ p, className }: { p: AnnouncementPriority; className?: string }) => {
    if (p === "CRITICAL") return <AlertCircle className={cn("size-3.5", className)} />;
    if (p === "WARNING") return <AlertTriangle className={cn("size-3.5", className)} />;
    return <Info className={cn("size-3.5", className)} />;
  };

  return (
    <div className={cn("bg-card border border-border/80 rounded-md overflow-hidden flex flex-col", className)}>
      {!hideHeader && (
        <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Megaphone className="size-3.5 text-primary shrink-0" /> Notice Board
              </h2>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                {announcements.length} Notices
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Official company broadcasts, news, and urgent alerts.
            </p>
          </div>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto divide-y divide-border/40", hideHeader && "-mx-1")}>
        {announcements.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="size-6 opacity-40" />
            <p className="text-xs font-semibold">No active notices</p>
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              onClick={handleItemClick}
              className={cn(
                "p-3 flex items-start gap-3 hover:bg-muted/30 transition-all rounded-md cursor-pointer group",
                a.priority === "CRITICAL" && "bg-rose-500/5"
              )}
            >
              <div className={cn("size-8 rounded-md p-1.5 shrink-0 border flex items-center justify-center transition-colors", priorityColors[a.priority])}>
                <PriorityIcon p={a.priority} />
              </div>

              <div className="flex-1 min-w-0">
                <h4
                  className={cn(
                    "text-xs font-bold leading-tight group-hover:text-primary transition-colors truncate",
                    a.priority === "CRITICAL" ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                  )}
                >
                  {a.title}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1 pr-2 mt-0.5">
                  {a.content ? stripHtml(a.content) : ""}
                </p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {format(a.createdAt, "MMM dd, yyyy")}
                  </span>
                  {a.targetDepartment && (
                    <span className="text-[9px] uppercase font-bold text-muted-foreground/70 bg-muted px-1.5 py-0.2 rounded-sm">
                      {a.targetDepartment.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
