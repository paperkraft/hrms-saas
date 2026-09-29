"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Folder,
  User,
  HardDrive,
  Loader2,
  Check,
  Building,
  Briefcase,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DuplicateGroup,
  getDriveDuplicates,
  trashDriveItems,
  deleteDriveItemsPermanently,
} from "@/actions/drive";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DriveScope } from "@prisma/client";
import { getFileTypeIcon } from "../drive-file-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  isTeamLeader?: boolean;
  isExternal?: boolean;
  onCleanupComplete: () => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DuplicatesModal({
  isOpen,
  onClose,
  userRole,
  isTeamLeader,
  isExternal,
  onCleanupComplete,
}: DuplicatesModalProps) {
  const [selectedScope, setSelectedScope] = useState<DriveScope | "ALL">("ALL");
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [totalReclaimable, setTotalReclaimable] = useState(0);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCleaning, setIsCleaning] = useState(false);
  const [isPermanentConfirmOpen, setIsPermanentConfirmOpen] = useState(false);

  const canDeletePermanently =
    !isExternal &&
    (userRole === "ADMIN" || userRole === "SYSTEM_ADMIN" || userRole === "ACCOUNTANT");

  // Load duplicates from server
  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDriveDuplicates({
        scope: selectedScope,
      });

      if (res.success) {
        setDuplicateGroups(res.duplicateGroups);
        setTotalReclaimable(res.totalReclaimableBytes);
        setTotalDuplicates(res.totalDuplicatesCount);

        // By default, auto-select all redundant duplicates (leaving the original untouched)
        const autoSelected = new Set<string>();
        res.duplicateGroups.forEach((group) => {
          group.items.forEach((item) => {
            if (item.id !== group.originalFileId) {
              autoSelected.add(item.id);
            }
          });
        });
        setSelectedIds(autoSelected);
      } else {
        toast.error(res.error || "Failed to scan for duplicate files");
        setDuplicateGroups([]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to scan for duplicate files");
      setDuplicateGroups([]);
    } finally {
      setLoading(false);
    }
  }, [selectedScope]);

  useEffect(() => {
    if (isOpen) {
      loadDuplicates();
    }
  }, [isOpen, loadDuplicates]);

  // Toggle selection for a single file
  const handleToggleFile = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  // Auto-Select All redundant copies across all groups
  const handleAutoSelectAll = () => {
    const autoSelected = new Set<string>();
    duplicateGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.id !== group.originalFileId) {
          autoSelected.add(item.id);
        }
      });
    });
    setSelectedIds(autoSelected);
    toast.info(`Selected ${autoSelected.size} redundant duplicate copies`);
  };

  // Deselect all
  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  // Calculate selected reclaimable size
  const selectedSizeSum = duplicateGroups.reduce((acc, group) => {
    group.items.forEach((item) => {
      if (selectedIds.has(item.id)) {
        acc += item.size;
      }
    });
    return acc;
  }, 0);

  // Execute Trash Cleanup
  const handleCleanupTrash = async () => {
    if (selectedIds.size === 0) return;
    setIsCleaning(true);

    try {
      const ids = Array.from(selectedIds);
      const res = await trashDriveItems(ids);

      if (res.success) {
        toast.success(`Cleaned up ${ids.length} duplicate ${ids.length === 1 ? "file" : "files"} (${formatBytes(selectedSizeSum)} freed)`);
        onCleanupComplete();
        onClose();
      } else {
        toast.error(res.error || "Failed to clean up files");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to clean up duplicate files");
    } finally {
      setIsCleaning(false);
    }
  };

  // Execute Permanent Delete (Admins only)
  const handleExecutePermanentDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsCleaning(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await deleteDriveItemsPermanently(ids);

      if (res.success) {
        toast.success(`Permanently deleted ${ids.length} duplicate files (${formatBytes(selectedSizeSum)} freed)`);
        setIsPermanentConfirmOpen(false);
        onCleanupComplete();
        onClose();
      } else {
        toast.error(res.error || "Failed to permanently delete files");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to permanently delete duplicate files");
    } finally {
      setIsCleaning(false);
    }
  };

  const scopeBadge = (scope: DriveScope) => {
    switch (scope) {
      case "ORGANIZATION_LIBRARY":
        return <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Library</span>;
      case "PROJECT":
        return <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">Project</span>;
      case "PERSONAL":
        return <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">My Drive</span>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isCleaning && onClose()}>
      <DialogContent className="w-[94vw] sm:max-w-2xl p-0 overflow-hidden rounded-lg bg-card border shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-4 border-b bg-muted/20 text-left shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 sm:w-5 h-4.5 sm:h-5" />
            </div>
            <div>
              <DialogTitle className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                <span>Duplicate Files Finder & Storage Optimizer</span>
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Scan your drive for redundant file copies and free up server storage space.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Reclaim Banner & Summary */}
        <div className="px-4 sm:px-6 py-3 border-b bg-muted/10 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-background/80">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <HardDrive className="w-4 sm:w-4.5 h-4 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs text-muted-foreground">Potential Storage Savings</div>
                <div className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-emerald-600 dark:text-emerald-400">{formatBytes(totalReclaimable)}</span>
                  <span className="text-muted-foreground font-normal text-[11px] sm:text-xs">
                    ({totalDuplicates} redundant {totalDuplicates === 1 ? "copy" : "copies"} in {duplicateGroups.length} groups)
                  </span>
                </div>
              </div>
            </div>

            {/* Auto Select Quick Buttons */}
            {duplicateGroups.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoSelectAll}
                  className="rounded-md text-xs h-7.5 px-2.5 font-medium gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Auto-Select Copies</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectNone}
                  className="rounded-md text-xs h-7.5 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Deselect All
                </Button>
              </div>
            )}
          </div>

          {/* Scope Filters */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-md border text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedScope("ALL")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap text-xs",
                selectedScope === "ALL"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>All Locations</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope("ORGANIZATION_LIBRARY")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap text-xs",
                selectedScope === "ORGANIZATION_LIBRARY"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building className="w-3.5 h-3.5 text-amber-500" />
              <span>Library</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope("PROJECT")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap text-xs",
                selectedScope === "PROJECT"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              <span>Project Docs</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope("PERSONAL")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md font-medium transition-all cursor-pointer whitespace-nowrap text-xs",
                selectedScope === "PERSONAL"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="w-3.5 h-3.5 text-emerald-500" />
              <span>My Drive</span>
            </button>
          </div>
        </div>

        {/* Duplicate Groups List Area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 min-h-55 max-h-96 space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Scanning drive for duplicate files...</span>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-foreground">No Duplicate Files Found</div>
              <div className="text-xs text-muted-foreground max-w-sm px-4">
                Your drive is completely optimized! No duplicate copies of files were found in the selected location.
              </div>
            </div>
          ) : (
            duplicateGroups.map((group, gIdx) => {
              const typeConfig = getFileTypeIcon(group.name, group.mimeType);
              const Icon = typeConfig.icon;

              return (
                <div
                  key={group.signature || gIdx}
                  className="rounded-lg border bg-card overflow-hidden shadow-2xs"
                >
                  {/* Group Header */}
                  <div className="px-3 sm:px-3.5 py-2 bg-muted/30 border-b flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className={cn("w-4 h-4 shrink-0", typeConfig.color)} />
                      <span className="font-semibold text-xs text-foreground truncate" title={group.name}>
                        {group.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden xs:inline">
                        ({formatBytes(group.size)} each)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        +{formatBytes(group.reclaimableSize)}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">
                        {group.totalCopies} copies
                      </span>
                    </div>
                  </div>

                  {/* List of Copies in this Group */}
                  <div className="divide-y divide-border/60">
                    {group.items.map((file) => {
                      const isOriginal = file.id === group.originalFileId;
                      const isChecked = selectedIds.has(file.id);

                      return (
                        <div
                          key={file.id}
                          onClick={() => handleToggleFile(file.id)}
                          className={cn(
                            "px-3 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 text-xs transition-colors cursor-pointer select-none",
                            isChecked
                              ? "bg-rose-500/5 hover:bg-rose-500/10"
                              : isOriginal
                              ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                              : "hover:bg-accent/40"
                          )}
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleFile(file.id)}
                              className="data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="font-medium text-foreground truncate max-w-36 xs:max-w-48 sm:max-w-64">
                                  {file.name}
                                </span>
                                {isOriginal ? (
                                  <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold px-1.5 py-0.2 rounded shrink-0">
                                    Original (Keep)
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-rose-500/10 text-rose-500 font-medium px-1.5 py-0.2 rounded shrink-0">
                                    Duplicate Copy
                                  </span>
                                )}
                                {scopeBadge(file.scope)}
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1 truncate max-w-32 sm:max-w-44" title={file.path}>
                                  <Folder className="w-3 h-3 text-primary/70 shrink-0" />
                                  <span className="truncate">{file.parentName}</span>
                                </span>
                                <span>•</span>
                                <span className="truncate max-w-24 sm:max-w-36">{file.ownerName}</span>
                                <span className="hidden xs:inline">•</span>
                                <span className="hidden xs:inline">{format(new Date(file.createdAt), "MMM d, yyyy")}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono text-[11px] sm:text-xs text-muted-foreground">
                              {formatBytes(file.size)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 w-full shrink-0">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            {selectedIds.size > 0 ? (
              <span className="font-medium text-foreground">
                Selected <span className="text-rose-500 font-bold">{selectedIds.size}</span> duplicates ({formatBytes(selectedSizeSum)} to free)
              </span>
            ) : (
              <span>Select duplicate files to remove</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isCleaning}
              className="flex-1 sm:flex-none rounded-md text-xs h-9 px-3.5 cursor-pointer"
            >
              Cancel
            </Button>

            {canDeletePermanently && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsPermanentConfirmOpen(true)}
                disabled={selectedIds.size === 0 || isCleaning}
                className="flex-1 sm:flex-none rounded-md text-xs h-9 px-3 gap-1.5 shadow-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Forever</span>
              </Button>
            )}

            {!isExternal && (
              <Button
                type="button"
                onClick={handleCleanupTrash}
                disabled={selectedIds.size === 0 || isCleaning}
                className="flex-1 sm:flex-none rounded-md text-xs h-9 px-4 gap-1.5 shadow-xs font-medium bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {isCleaning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      <AlertDialog
        open={isPermanentConfirmOpen}
        onOpenChange={(open) => !open && !isCleaning && setIsPermanentConfirmOpen(false)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base font-semibold">
              <Trash2 className="w-5 h-5 text-destructive shrink-0" />
              <span>Permanently Delete Duplicate Files?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-2.5">
              <span className="block text-foreground text-sm font-medium">
                Are you sure you want to permanently delete {selectedIds.size} file(s) ({formatBytes(selectedSizeSum)})?
              </span>
              <span className="block bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2.5 text-xs font-normal leading-relaxed">
                ⚠️ <strong>This action cannot be undone.</strong> These files will be permanently removed from MinIO storage and the database.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              disabled={isCleaning}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isCleaning}
              onClick={handleExecutePermanentDelete}
              className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
            >
              {isCleaning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Delete Permanently</span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
