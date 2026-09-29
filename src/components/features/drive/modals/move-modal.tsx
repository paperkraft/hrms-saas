"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Folder,
  FolderInput,
  Home,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Search,
  Plus,
  Briefcase,
  User,
  Building,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DriveItemWithDetails,
  getDestinationFolders,
  createDriveFolder,
} from "@/actions/drive";
import { DriveScope } from "@prisma/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DestinationFolderItem {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  scope: DriveScope;
  color?: string | null;
  childFolderCount: number;
}

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsToMove: DriveItemWithDetails[];
  allFolders?: DriveItemWithDetails[];
  onSubmit: (targetFolderId: string | null, targetScope?: DriveScope) => Promise<void>;
  isExternal?: boolean;
}

export function MoveModal({
  isOpen,
  onClose,
  itemsToMove,
  onSubmit,
  isExternal = false,
}: MoveModalProps) {
  // Active scope tab
  const [activeScope, setActiveScope] = useState<DriveScope>("ORGANIZATION_LIBRARY");

  // Navigation hierarchy inside modal
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<{ id: string | null; name: string }[]>([]);

  // Destination folder selection
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>("Root Directory");

  // Folder content & search
  const [folders, setFolders] = useState<DestinationFolderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline new folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);

  const excludeIds = useMemo(() => itemsToMove.map((i) => i.id), [itemsToMove]);
  const excludeIdsKey = useMemo(() => excludeIds.join(","), [excludeIds]);

  // Load destination folders
  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDestinationFolders({
        scope: activeScope,
        parentId: searchQuery ? null : currentParentId,
        searchQuery: searchQuery.trim() || undefined,
        excludeIds,
      });

      if (res.success) {
        setFolders(res.folders);
      } else {
        setFolders([]);
      }
    } catch (err) {
      console.error("Error loading destination folders:", err);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [activeScope, currentParentId, searchQuery, excludeIdsKey]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      const initialScope = itemsToMove[0]?.scope || "ORGANIZATION_LIBRARY";
      setActiveScope(initialScope);
      setCurrentParentId(null);
      setNavHistory([]);
      setSelectedFolderId(null);
      setSelectedFolderName("Root Directory");
      setSearchQuery("");
      setIsCreatingFolder(false);
      setNewFolderName("");
    }
  }, [isOpen]);

  // Load folders for current view
  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen, loadFolders]);

  // Drill down into a subfolder
  const handleOpenFolder = (folder: DestinationFolderItem) => {
    setCurrentParentId(folder.id);
    setSelectedFolderId(folder.id);
    setSelectedFolderName(folder.name);
    setNavHistory((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSearchQuery("");
  };

  // Go back one level
  const handleGoBack = () => {
    if (navHistory.length === 0) return;
    const newHistory = [...navHistory];
    newHistory.pop();
    const parent = newHistory[newHistory.length - 1];

    setCurrentParentId(parent ? parent.id : null);
    setSelectedFolderId(parent ? parent.id : null);
    setSelectedFolderName(parent ? parent.name : "Root Directory");
    setNavHistory(newHistory);
    setSearchQuery("");
  };

  // Switch Scope Tab
  const handleScopeChange = (newScope: DriveScope) => {
    setActiveScope(newScope);
    setCurrentParentId(null);
    setSelectedFolderId(null);
    setSelectedFolderName("Root Directory");
    setNavHistory([]);
    setSearchQuery("");
  };

  // Inline Folder Creation
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || isCreatingLoading) return;

    setIsCreatingLoading(true);
    try {
      const res = await createDriveFolder({
        name: newFolderName.trim(),
        scope: activeScope,
        parentId: currentParentId,
      });

      if (res.success && res.folder) {
        toast.success(`Created folder "${newFolderName.trim()}"`);
        setNewFolderName("");
        setIsCreatingFolder(false);
        await loadFolders();
        setSelectedFolderId(res.folder.id);
        setSelectedFolderName(res.folder.name);
      } else {
        toast.error(res.error || "Failed to create folder");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create folder");
    } finally {
      setIsCreatingLoading(false);
    }
  };

  // Submit Move Action
  const handleMove = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(selectedFolderId, activeScope);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to move items");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scopeLabels: Record<DriveScope, string> = {
    ORGANIZATION_LIBRARY: "Company Library",
    PROJECT: "Project Documents",
    PERSONAL: "My Drive",
    DEPARTMENT: "Department",
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="w-[94vw] sm:max-w-130 p-0 overflow-hidden rounded-lg bg-card border shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-4 border-b bg-muted/20 text-left shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <FolderInput className="w-4.5 sm:w-5 h-4.5 sm:h-5" />
            </div>
            <div>
              <DialogTitle className="text-xs sm:text-sm font-semibold text-foreground">
                Move {itemsToMove.length} {itemsToMove.length === 1 ? "Item" : "Items"}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Organize items by choosing a destination location or folder.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Location Scope Tabs */}
        {!isExternal && (
          <div className="px-4 sm:px-6 pt-3 pb-2 border-b bg-muted/10 shrink-0">
            <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-md border text-xs">
              <button
                type="button"
                onClick={() => handleScopeChange("ORGANIZATION_LIBRARY")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                  activeScope === "ORGANIZATION_LIBRARY"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Building className="w-3.5 h-3.5 text-amber-500" />
                <span className="truncate">Library</span>
              </button>

              <button
                type="button"
                onClick={() => handleScopeChange("PROJECT")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                  activeScope === "PROJECT"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                <span className="truncate">Project Docs</span>
              </button>

              <button
                type="button"
                onClick={() => handleScopeChange("PERSONAL")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                  activeScope === "PERSONAL"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="w-3.5 h-3.5 text-emerald-500" />
                <span className="truncate">My Drive</span>
              </button>
            </div>
          </div>
        )}

        {/* Search Bar & Breadcrumb Navigation Header */}
        <div className="px-4 sm:px-6 py-2 sm:py-2.5 border-b bg-card space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search folders in ${scopeLabels[activeScope]}...`}
              className="pl-8 pr-7 h-8 rounded-md text-xs bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {!searchQuery && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 overflow-hidden">
              {navHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="p-1 rounded-md hover:bg-accent text-foreground transition-colors mr-1 cursor-pointer"
                  title="Go back"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCurrentParentId(null);
                  setSelectedFolderId(null);
                  setSelectedFolderName("Root Directory");
                  setNavHistory([]);
                }}
                className={cn(
                  "hover:text-primary transition-colors truncate font-medium",
                  currentParentId === null && "text-foreground font-semibold"
                )}
              >
                {scopeLabels[activeScope]}
              </button>

              {navHistory.map((item, idx) => (
                <React.Fragment key={item.id || idx}>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span
                    className={cn(
                      "truncate font-medium",
                      idx === navHistory.length - 1 ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {item.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Directory Explorer List Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 min-h-55 max-h-75">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-12 text-muted-foreground text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Loading folders...</span>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Root Directory Destination Option (when at root level and not searching) */}
              {!searchQuery && (!isExternal || currentParentId !== null) && (
                <div
                  onClick={() => {
                    setSelectedFolderId(currentParentId);
                    setSelectedFolderName(
                      currentParentId
                        ? navHistory[navHistory.length - 1]?.name || "Current Folder"
                        : "Root Directory"
                    );
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors cursor-pointer select-none",
                    selectedFolderId === currentParentId
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "hover:bg-accent/60 text-foreground border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Home className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">
                      {currentParentId ? "Current Folder Level" : "Root Directory"}
                    </span>
                  </div>
                  {selectedFolderId === currentParentId && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </div>
              )}

              {/* Subfolders List */}
              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setSelectedFolderName(folder.name);
                    }}
                    onDoubleClick={() => handleOpenFolder(folder)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors cursor-pointer select-none group",
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                        : "hover:bg-accent/60 text-foreground border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Folder
                        className="w-4 h-4 text-amber-500 shrink-0"
                        style={folder.color ? { color: folder.color } : undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="truncate block">{folder.name}</span>
                        {searchQuery && (
                          <span className="text-[10px] text-muted-foreground font-normal block truncate">
                            {folder.path}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                        {folder.childFolderCount > 0 ? `${folder.childFolderCount} sub` : ""}
                      </span>

                      {/* Drilldown Arrow Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFolder(folder);
                        }}
                        className="p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                        title="Open folder"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {folders.length === 0 && (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  {searchQuery ? "No matching folders found" : "No subfolders in this location"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline Create New Folder Bar */}
        {isCreatingFolder ? (
          <form
            onSubmit={handleCreateFolder}
            className="px-4 sm:px-6 py-2 border-t bg-muted/20 flex items-center gap-2 shrink-0 animate-in fade-in duration-200"
          >
            <Folder className="w-4 h-4 text-primary shrink-0" />
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name..."
              className="h-8 text-xs rounded-md flex-1 bg-background"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newFolderName.trim() || isCreatingLoading}
              className="h-8 rounded-md text-xs px-3"
            >
              {isCreatingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }}
              className="h-8 rounded-md text-xs px-2"
            >
              Cancel
            </Button>
          </form>
        ) : null}

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t bg-muted/20 flex items-center justify-between gap-2 sm:gap-3 w-full shrink-0">
          <div className="flex items-center gap-2">
            {!isCreatingFolder && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingFolder(true)}
                className="rounded-md text-xs gap-1.5 h-8.5 px-2.5 sm:px-3 cursor-pointer hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">New Folder</span>
                <span className="xs:hidden">New</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md text-xs h-8.5 px-3 sm:px-4"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleMove}
              disabled={isSubmitting || (isExternal && !selectedFolderId)}
              className="rounded-md text-xs px-4 sm:px-5 h-8.5 font-medium gap-1.5 shadow-xs"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Move here</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
