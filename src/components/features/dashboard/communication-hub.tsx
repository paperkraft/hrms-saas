"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";
import {
  Megaphone,
  BookOpen,
  Shield,
  Clock,
  HeartHandshake,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Building2,
  User,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";

interface CommunicationHubProps {
  announcements: any[];
  notifications?: any[];
  policies?: any[];
  role?: string;
  userAllowedMenus?: string[];
  className?: string;
}

export function CommunicationHub({
  announcements = [],
  policies = [],
  role,
  userAllowedMenus,
  className,
}: CommunicationHubProps) {
  const router = useRouter();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  // Communication hub (announcements & workplace policies) is a universal company broadcast
  // and resource widget that must always be visible to all employees on their dashboard.
  const canAccessNotices = true;
  const canAccessPolicies = true;

  const defaultTab = "announcements";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleViewAll = () => {
    if (activeTab === "announcements") {
      router.push("/dashboard/announcements");
    } else if (activeTab === "policies") {
      router.push("/dashboard/policies");
    }
  };

  function getPolicyIcon(category: string) {
    if (category.toLowerCase().includes("conduct")) return UserCheck;
    if (category.toLowerCase().includes("attendance") || category.toLowerCase().includes("leave")) return Clock;
    if (category.toLowerCase().includes("security") || category.toLowerCase().includes("privacy")) return Shield;
    return HeartHandshake;
  }

  function getNoticeConfig(priority: string) {
    switch (priority) {
      case "CRITICAL":
        return {
          icon: AlertCircle,
          className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        };
      case "WARNING":
        return {
          icon: AlertTriangle,
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        };
      default:
        return {
          icon: Megaphone,
          className: "bg-primary/10 text-primary",
        };
    }
  }

  const tabCount = (canAccessNotices ? 1 : 0) + (canAccessPolicies ? 1 : 0);
  const gridColsClass = tabCount === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className={cn("bg-card border border-border/80 rounded-md shadow-2xs flex flex-col h-[430px]", className)}>
      <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Megaphone className="size-3.5 text-primary shrink-0" /> Communication Hub
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {announcements.length + policies.length} Items
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5">
            Company bulletins, official announcements, and workplace policies.
          </p>
        </div>
      </div>

      <div className="p-3.5 flex-1 flex flex-col overflow-hidden pb-0">
        <Tabs defaultValue={defaultTab} value={activeTab} className="w-full flex-1 flex flex-col overflow-hidden" onValueChange={setActiveTab}>
          <TabsList className={cn("grid w-full bg-muted/40 p-1 h-9 rounded-md border border-border/70", gridColsClass)}>
            {canAccessNotices && (
              <TabsTrigger
                value="announcements"
                className="rounded-md text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Megaphone className="size-3.5" />
                <span>Notices</span>
              </TabsTrigger>
            )}
            {canAccessPolicies && (
              <TabsTrigger
                value="policies"
                className="rounded-md text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="size-3.5" />
                <span>Policies</span>
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 overflow-hidden">
            {/* ── Notices (Announcements) ── */}
            {canAccessNotices && (
              <TabsContent value="announcements" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
                <div className="divide-y divide-border/40">
                  {announcements.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Megaphone className="size-8 opacity-40" />
                      <p className="text-xs font-semibold">No active notices</p>
                    </div>
                  ) : (
                    announcements.map((a) => {
                      const config = getNoticeConfig(a.priority || "INFO");
                      const Icon = config.icon;
                      const dateStr = format(new Date(a.createdAt), "MMM dd");

                      return (
                        <div
                          key={a.id}
                          onClick={() => setSelectedAnnouncement(a)}
                          className={cn(
                            "p-3 hover:bg-muted/30 transition-colors cursor-pointer flex items-center justify-between gap-3 group rounded-md",
                            a.priority === "CRITICAL" && "bg-rose-500/5"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn("size-7 rounded-md flex items-center justify-center shrink-0", config.className)}>
                              <Icon className="size-3.5" />
                            </div>
                            <div className="truncate">
                              <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                {a.title}
                              </h4>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                                {a.targetDepartment?.name || "Company Wide"}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-medium">{dateStr}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            )}

            {/* ── Policies ── */}
            {canAccessPolicies && (
              <TabsContent value="policies" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
                <div className="divide-y divide-border/40">
                  {policies.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <BookOpen className="size-8 opacity-40" />
                      <p className="text-xs font-semibold">No policies published</p>
                    </div>
                  ) : (
                    policies.map((p) => {
                      const Icon = getPolicyIcon(p.category || "");
                      return (
                        <div
                          key={p.id}
                          onClick={() => router.push(`/dashboard/policies?policy=${p.id}`)}
                          className="p-3 hover:bg-muted/30 transition-colors cursor-pointer flex items-center justify-between gap-3 group rounded-md"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Icon className="size-3.5" />
                            </div>
                            <div className="truncate">
                              <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                {p.title}
                              </h4>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.category || "General"}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-medium">v{p.version || "1.0"}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      <div className="px-5 py-3 border-t border-border/70 bg-muted/10 flex items-center justify-between text-xs shrink-0">
        <span className="text-muted-foreground text-[11px] font-medium">Stay updated with company broadcasts</span>
        <button
          onClick={handleViewAll}
          className="text-xs font-semibold text-primary hover:underline cursor-pointer"
        >
          View All →
        </button>
      </div>

      {/* Detailed Announcement Modal Reader */}
      {selectedAnnouncement && (
        <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
          <DialogContent className="w-[calc(100%-1.5rem)] sm:w-full max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-lg sm:rounded-xl">
            <div className="p-4 sm:p-6 flex flex-col max-h-[90vh] overflow-hidden gap-3.5 sm:gap-4">
              <DialogHeader className="space-y-2 pr-7 sm:pr-6 shrink-0 text-left">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0",
                    selectedAnnouncement.priority === "CRITICAL" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                    selectedAnnouncement.priority === "WARNING" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                    "bg-primary/10 text-primary border border-primary/20"
                  )}>
                    {selectedAnnouncement.priority || "GENERAL"}
                  </span>
                  <span className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Calendar className="size-3 shrink-0" />
                    {format(new Date(selectedAnnouncement.createdAt), "MMM dd, yyyy")}
                  </span>
                  {selectedAnnouncement.targetDepartment?.name && (
                    <span className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[180px] sm:max-w-none">
                      <Building2 className="size-3 shrink-0" />
                      <span className="truncate">{selectedAnnouncement.targetDepartment.name}</span>
                    </span>
                  )}
                </div>
                <DialogTitle className="text-sm sm:text-base font-bold text-foreground leading-snug break-words">
                  {selectedAnnouncement.title}
                </DialogTitle>
                {selectedAnnouncement.author?.name && (
                  <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1">
                    <User className="size-3 shrink-0" />
                    <span>Posted by {selectedAnnouncement.author.name}</span>
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="text-xs text-foreground/90 leading-relaxed flex-1 min-h-0 max-h-[50vh] sm:max-h-[320px] overflow-y-auto bg-muted/20 p-3 sm:p-4 rounded-md border border-border/60 break-words">
                <RichTextViewer
                  content={selectedAnnouncement.content}
                  className="text-xs font-normal text-foreground/90 [&_p]:mb-2.5 [&_p]:last:mb-0 [&_strong]:text-foreground [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                />
              </div>

              <div className="flex items-center justify-between pt-2.5 sm:pt-2 border-t border-border/40 shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2.5 sm:px-3 py-1.5 rounded-md hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnnouncement(null);
                    router.push("/dashboard/announcements");
                  }}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Go to Notices Page</span>
                  <ExternalLink className="size-3" />
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
