"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Folder,
  Search,
  FileText,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getFileTypeIcon } from "../drive-file-card";
import { cn } from "@/lib/utils";

export interface SyncedFileSummaryItem {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  extension: string | null;
  scope: string;
  parentName?: string;
}

interface SyncResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncedFiles: SyncedFileSummaryItem[];
  createdFoldersCount: number;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function SyncResultsModal({
  isOpen,
  onClose,
  syncedFiles,
  createdFoldersCount,
}: SyncResultsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFiles = syncedFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const formatScopeLabel = (scope: string) => {
    switch (scope) {
      case "ORGANIZATION_LIBRARY":
        return "Company Library";
      case "PROJECT":
        return "Project Docs";
      case "PERSONAL":
        return "My Drive";
      default:
        return scope;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[94vw] sm:max-w-2xl p-0 overflow-hidden flex flex-col max-h-[85vh] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-linear-to-r from-emerald-500/10 via-primary/5 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span>Storage Synchronization Complete</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Imported <strong className="text-foreground">{syncedFiles.length} file{syncedFiles.length === 1 ? "" : "s"}</strong>
                  {createdFoldersCount > 0 && (
                    <> and created <strong className="text-foreground">{createdFoldersCount} folder{createdFoldersCount === 1 ? "" : "s"}</strong></>
                  )}{" "}
                  from MinIO storage.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Quick Filter Search if more than 4 files */}
          {syncedFiles.length > 4 && (
            <div className="mt-4 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter synchronized files..."
                className="pl-8.5 pr-8 h-8 text-xs bg-background/80"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable File List */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border/60">
          {filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No files matching "{searchQuery}"
            </div>
          ) : (
            filteredFiles.map((file) => {
              const typeConfig = getFileTypeIcon(file.mimeType, file.extension);
              const Icon = typeConfig.icon || FileText;

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/40 transition-colors text-xs"
                >
                  {/* File Icon & Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        typeConfig.bg || "bg-primary/10"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", typeConfig.color || "text-primary")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                        <span>{formatBytes(file.size)}</span>
                        {file.parentName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 truncate text-foreground/70">
                              <Folder className="w-3 h-3 shrink-0" />
                              <span className="truncate">{file.parentName}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scope Badge */}
                  <Badge variant="outline" className="text-[10px] font-normal shrink-0 border-muted-foreground/30">
                    {formatScopeLabel(file.scope)}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Showing {filteredFiles.length} of {syncedFiles.length} files
          </span>
          <Button size="sm" onClick={onClose} className="h-8 px-4 text-xs font-medium cursor-pointer">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
