"use client";

import React from "react";
import {
  Folder,
  Briefcase,
  User,
  Users,
  Star,
  Clock,
  Trash2,
  HardDrive,
  Plus,
  X,
  FileUp,
  FolderUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DriveScopeType =
  | "ORGANIZATION_LIBRARY"
  | "PROJECT"
  | "PERSONAL"
  | "SHARED_WITH_ME"
  | "STARRED"
  | "RECENT"
  | "TRASH";

interface DriveSidebarProps {
  currentScope: DriveScopeType;
  currentFolderId?: string | null;
  isCurrentFolderEditor?: boolean;
  onSelectScope: (scope: DriveScopeType) => void;
  onOpenNewFolder: () => void;
  onOpenUpload: (mode?: "file" | "folder") => void;
  onOpenDuplicates?: () => void;
  onCloseMobile?: () => void;
  className?: string;
  isExternal?: boolean;
  storageStats?: {
    totalSizeBytes: number;
    totalFiles: number;
    totalFolders: number;
    personalQuota?: {
      usedBytes: number;
      quotaBytes: number;
      remainingBytes: number;
      usedPercent: number;
      maxFileSizeBytes: number;
      isExceeded: boolean;
    } | null;
    breakdown: {
      pdf: number;
      spreadsheet: number;
      image: number;
      documents: number;
      media: number;
      other: number;
    };
  } | null;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DriveSidebar({
  currentScope,
  currentFolderId,
  isCurrentFolderEditor = false,
  onSelectScope,
  onOpenNewFolder,
  onOpenUpload,
  onOpenDuplicates,
  onCloseMobile,
  className,
  isExternal,
  storageStats,
}: DriveSidebarProps) {
  const allNavItems: {
    id: DriveScopeType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color?: string;
  }[] = [
    {
      id: "ORGANIZATION_LIBRARY",
      label: "Company Library",
      icon: Folder,
      color: "text-amber-500",
    },
    {
      id: "PROJECT",
      label: "Project Documents",
      icon: Briefcase,
      color: "text-blue-500",
    },
    {
      id: "PERSONAL",
      label: "My Drive",
      icon: User,
      color: "text-emerald-500",
    },
    {
      id: "SHARED_WITH_ME",
      label: "Shared with me",
      icon: Users,
      color: "text-purple-500",
    },
    {
      id: "STARRED",
      label: "Starred",
      icon: Star,
      color: "text-yellow-500",
    },
    {
      id: "RECENT",
      label: "Recent",
      icon: Clock,
      color: "text-indigo-500",
    },
    {
      id: "TRASH",
      label: "Trash",
      icon: Trash2,
      color: "text-rose-500",
    },
  ];

  const navItems = isExternal
    ? allNavItems.filter((item) => item.id !== "PROJECT" && item.id !== "TRASH" && item.id !== "RECENT")
    : allNavItems;

  const totalSizeBytes = storageStats?.totalSizeBytes || 0;
  const storageLimitBytes = 500 * 1024 * 1024 * 1024; // 500 GB
  const usedPercent = Math.min(100, Math.round((totalSizeBytes / storageLimitBytes) * 100));

  const isUploadDisabled =
    currentScope === "TRASH" ||
    currentScope === "STARRED" ||
    currentScope === "RECENT" ||
    (currentScope === "SHARED_WITH_ME" && !isCurrentFolderEditor);

  return (
    <aside className={cn("w-52 bg-card/95 backdrop-blur-md border-r flex flex-col h-full select-none shrink-0 transition-all", className)}>
      {/* Mobile Header with Close Button */}
      {onCloseMobile && (
        <div className="md:hidden h-12 px-3 border-b flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation
          </span>
          <Button variant="ghost" size="icon" onClick={onCloseMobile} className="rounded-full w-7 h-7">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Quick Action Button (Google Drive Style Dropdown) */}
      <div className="h-14 px-3 border-b flex items-center shrink-0">
        {isUploadDisabled ? (
          <Button
            disabled
            className="w-full bg-muted/60 text-muted-foreground font-medium rounded-md h-9 text-xs flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
            title="Uploads and new folders are not allowed in this section"
          >
            <Plus className="w-4 h-4" />
            <span>New / Upload</span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="w-full shadow-xs hover:shadow-sm transition-all bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md h-9 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New / Upload</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 rounded-lg text-xs p-1 shadow-lg">
              <DropdownMenuItem
                onClick={() => {
                  onOpenUpload("file");
                  onCloseMobile?.();
                }}
                className="gap-2.5 py-2 rounded-md cursor-pointer"
              >
                <FileUp className="w-4 h-4 text-primary" />
                <span>File upload</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onOpenUpload("folder");
                  onCloseMobile?.();
                }}
                className="gap-2.5 py-2 rounded-md cursor-pointer"
              >
                <FolderUp className="w-4 h-4 text-amber-500" />
                <span>Folder upload</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  onOpenNewFolder();
                  onCloseMobile?.();
                }}
                className="gap-2.5 py-2 rounded-md cursor-pointer"
              >
                <Folder className="w-4 h-4 text-blue-500" />
                <span>New folder</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Locations
        </div>
        {navItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const isActive = currentScope === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectScope(item.id);
                onCloseMobile?.();
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left group",
                isActive
                  ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive ? "text-primary" : item.color || "text-muted-foreground"
                )}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Views
        </div>
        {navItems.slice(3).map((item) => {
          const Icon = item.icon;
          const isActive = currentScope === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectScope(item.id);
                onCloseMobile?.();
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left group",
                isActive
                  ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive ? "text-primary" : item.color || "text-muted-foreground"
                )}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Storage Indicator */}
      <div className="p-3 border-t bg-card/40 space-y-2">
        {(() => {
          const isPersonal = currentScope === "PERSONAL";
          const pq = storageStats?.personalQuota;

          const usedBytes = isPersonal && pq ? pq.usedBytes : totalSizeBytes;
          const limitBytes = isPersonal && pq ? pq.quotaBytes : (500 * 1024 * 1024 * 1024);
          const percent = isPersonal && pq ? pq.usedPercent : Math.min(100, Math.round((totalSizeBytes / limitBytes) * 100));

          const progressColor =
            percent >= 90
              ? "[&>div]:bg-rose-500"
              : percent >= 75
              ? "[&>div]:bg-amber-500"
              : "[&>div]:bg-primary";

          return (
            <>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
                  <HardDrive className={cn("w-3.5 h-3.5", percent >= 90 ? "text-rose-500" : percent >= 75 ? "text-amber-500" : "text-primary")} />
                  <span>{isPersonal ? "My Storage" : "Total Storage"}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatBytes(usedBytes, 1)} / {formatBytes(limitBytes, 0)}
                </span>
              </div>

              <Progress value={percent} className={cn("h-1.5 bg-muted", progressColor)} />

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {isPersonal && pq
                    ? `${formatBytes(pq.remainingBytes, 1)} free`
                    : storageStats?.totalFiles
                    ? `${storageStats.totalFiles.toLocaleString()} files`
                    : "Ready"}
                </span>
                <span className={cn("font-bold", percent >= 90 ? "text-rose-500" : percent >= 75 ? "text-amber-600" : "text-muted-foreground")}>
                  {percent}%
                </span>
              </div>
            </>
          );
        })()}

        {!isExternal && onOpenDuplicates && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenDuplicates();
              onCloseMobile?.();
            }}
            className="w-full h-7 rounded-md text-[11px] font-medium gap-1.5 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-foreground transition-all cursor-pointer mt-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Find duplicates</span>
          </Button>
        )}
      </div>
    </aside>
  );
}
