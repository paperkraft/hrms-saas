"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FolderPlus,
  Upload,
  Trash2,
  RotateCcw,
  FolderInput,
  Loader2,
  Inbox,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  DriveItemWithDetails,
  BreadcrumbItem,
  getDriveContents,
  createDriveFolder,
  renameDriveItem,
  moveDriveItems,
  toggleStarDriveItem,
  trashDriveItems,
  restoreDriveItems,
  deleteDriveItemsPermanently,
  getDriveDownloadUrl,
  updateDriveFolderColor,
  getDriveStorageStats,
  syncDriveStorage,
} from "@/actions/drive";
import { Button } from "@/components/ui/button";
import { DriveSidebar, DriveScopeType } from "./drive-sidebar";
import { isExternalUser } from "@/lib/permissions";
import { DriveTopbar } from "./drive-topbar";
import { DriveBreadcrumbs } from "./drive-breadcrumbs";
import { DriveFolderCard } from "./drive-folder-card";
import { DriveFileCard } from "./drive-file-card";
import { DriveTableView } from "./drive-table-view";
import { DriveDetailsPanel } from "./drive-details-panel";
import { NewFolderModal } from "./modals/new-folder-modal";
import { RenameModal } from "./modals/rename-modal";
import { MoveModal } from "./modals/move-modal";
import { UploadModal } from "./modals/upload-modal";
import { ShareModal } from "./modals/share-modal";
import { DuplicatesModal } from "./modals/duplicates-modal";
import { SyncResultsModal, SyncedFileSummaryItem } from "./modals/sync-results-modal";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface DriveClientProps {
  initialScope?: DriveScopeType;
  userRole: string;
  isTeamLeader?: boolean;
  isExternal?: boolean;
  currentUserId?: string;
}

export function DriveClient({
  initialScope = "ORGANIZATION_LIBRARY",
  userRole,
  isTeamLeader,
  isExternal,
  currentUserId,
}: DriveClientProps) {
  const router = useRouter();
  const isExternalUserBool = isExternal ?? isExternalUser({ role: userRole });
  const canDeletePermanently =
    !isExternalUserBool &&
    (userRole === "ADMIN" || userRole === "SYSTEM_ADMIN" || userRole === "ACCOUNTANT");

  // Navigation & Scope State
  const [scope, setScope] = useState<DriveScopeType>(
    isExternalUserBool && (initialScope === "PROJECT" || initialScope === "TRASH" || initialScope === "RECENT")
      ? "ORGANIZATION_LIBRARY"
      : initialScope
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderInfo, setCurrentFolderInfo] = useState<DriveItemWithDetails | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Content Data
  const [folders, setFolders] = useState<DriveItemWithDetails[]>([]);
  const [files, setFiles] = useState<DriveItemWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "updatedAt" | "size" | "type">(
    initialScope === "RECENT" ? "updatedAt" : "name"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    initialScope === "RECENT" ? "desc" : "asc"
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("list"); // Default view is List

  // Selection & Details
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<DriveItemWithDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsActiveTab, setDetailsActiveTab] = useState<"preview" | "details" | "activity">("details");

  // Mobile Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Storage Stats
  const [storageStats, setStorageStats] = useState<any>(null);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "folder">("file");
  const [renameItem, setRenameItem] = useState<DriveItemWithDetails | null>(null);
  const [moveItemsList, setMoveItemsList] = useState<DriveItemWithDetails[]>([]);
  const [shareItem, setShareItem] = useState<DriveItemWithDetails | null>(null);
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false);
  const [isSyncingStorage, setIsSyncingStorage] = useState(false);
  const [syncedResults, setSyncedResults] = useState<{
    syncedFiles: SyncedFileSummaryItem[];
    createdFoldersCount: number;
  } | null>(null);

  // Permanent Delete & Empty Trash Alert Dialog State
  const [permanentDeleteItems, setPermanentDeleteItems] = useState<DriveItemWithDetails[] | null>(null);
  const [isEmptyTrashConfirm, setIsEmptyTrashConfirm] = useState(false);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);

  // Move to Trash Confirmation Dialog State
  const [moveToTrashItems, setMoveToTrashItems] = useState<DriveItemWithDetails[] | null>(null);
  const [isMovingToTrash, setIsMovingToTrash] = useState(false);

  // Drag over viewport
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  // ── Load Storage Stats ───────────────────────────────────────────────────
  const loadStorageStats = useCallback(async () => {
    try {
      const statsRes = await getDriveStorageStats();
      if (statsRes.success) {
        setStorageStats(statsRes);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadStorageStats();
  }, [loadStorageStats]);

  // ── Load Drive Contents ────────────────────────────────────────────────────
  const loadContents = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setIsRefreshing(true);
      setPage(1);
      try {
        const contentsRes = await getDriveContents({
          scope,
          folderId: currentFolderId,
          searchQuery,
          typeFilter,
          sortBy,
          sortOrder,
          page: 1,
          pageSize: 60,
        });

        if (contentsRes.success) {
          setFolders(contentsRes.folders || []);
          setFiles(contentsRes.files || []);
          setBreadcrumbs(contentsRes.breadcrumbs || []);
          setTotalCount(contentsRes.totalCount || 0);
          setHasMore(!!contentsRes.hasMore);
          setCurrentFolderInfo(contentsRes.currentFolder || null);

          // Synchronize scope to true folder location (unless browsing inside Trash or Shared with me)
          if (
            contentsRes.currentFolder?.scope &&
            contentsRes.currentFolder.scope !== scope &&
            scope !== "TRASH" &&
            scope !== "SHARED_WITH_ME" &&
            (!isExternalUserBool || contentsRes.currentFolder.scope !== "PROJECT")
          ) {
            setScope(contentsRes.currentFolder.scope as DriveScopeType);
          }
        } else {
          toast.error(contentsRes.error || "Failed to load drive contents");
          setCurrentFolderInfo(null);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to fetch drive data");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [scope, currentFolderId, searchQuery, typeFilter, sortBy, sortOrder]
  );

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const contentsRes = await getDriveContents({
        scope,
        folderId: currentFolderId,
        searchQuery,
        typeFilter,
        sortBy,
        sortOrder,
        page: nextPage,
        pageSize: 60,
      });

      if (contentsRes.success) {
        setFolders((prev) => [...prev, ...(contentsRes.folders || [])]);
        setFiles((prev) => [...prev, ...(contentsRes.files || [])]);
        setPage(nextPage);
        setHasMore(!!contentsRes.hasMore);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load more items");
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadContents();
  }, [loadContents]);

  // Clear selections when navigating
  useEffect(() => {
    setSelectedIds([]);
  }, [scope, currentFolderId]);

  // ── Scope & Folder Navigation ──────────────────────────────────────────────
  const handleSelectScope = (newScope: DriveScopeType) => {
    if (isExternalUserBool && (newScope === "PROJECT" || newScope === "TRASH" || newScope === "RECENT")) {
      toast.error("You do not have permission to access this section");
      return;
    }
    setScope(newScope);
    setCurrentFolderId(null);
    setSearchQuery("");
    if (newScope === "RECENT") {
      setSortBy("updatedAt");
      setSortOrder("desc");
    } else {
      setSortBy("name");
      setSortOrder("asc");
    }
  };

  const handleNavigateFolder = (folderId: string | null, targetScope?: DriveScopeType) => {
    setSearchQuery("");
    if (targetScope && targetScope !== scope) {
      if (scope === "SHARED_WITH_ME" && folderId) {
        // Stay in SHARED_WITH_ME when navigating subfolders of a shared folder
      } else if (!isExternalUserBool || targetScope !== "PROJECT") {
        setScope(targetScope);
        if (targetScope === "RECENT") {
          setSortBy("updatedAt");
          setSortOrder("desc");
        } else {
          setSortBy("name");
          setSortOrder("asc");
        }
      }
    }
    setCurrentFolderId(folderId);
  };

  const handleOpenFolder = (folder: DriveItemWithDetails) => {
    if (scope === "SHARED_WITH_ME") {
      // Stay in SHARED_WITH_ME scope while navigating inside a shared folder
    } else if (folder.scope && folder.scope !== scope && scope !== "TRASH") {
      if (!isExternalUserBool || folder.scope !== "PROJECT") {
        setScope(folder.scope as DriveScopeType);
        if ((folder.scope as string) === "RECENT") {
          setSortBy("updatedAt");
          setSortOrder("desc");
        } else {
          setSortBy("name");
          setSortOrder("asc");
        }
      }
    }
    setCurrentFolderId(folder.id);
    setSearchQuery("");
  };

  // ── Selection & Preview Handlers ───────────────────────────────────────────
  const handleToggleSelect = (
    id: string,
    e?: React.MouseEvent | { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
  ) => {
    if (typeof (e as any)?.stopPropagation === "function") {
      (e as any).stopPropagation();
    }

    const isMultiSelectKey = Boolean(e?.ctrlKey || e?.metaKey);
    const isShiftKey = Boolean(e?.shiftKey);

    setSelectedIds((prev) => {
      let newSelection: string[];

      if (isShiftKey && prev.length > 0) {
        // Shift range selection
        const allItems = [...folders, ...files];
        const lastSelectedId = prev[prev.length - 1];
        const lastIdx = allItems.findIndex((i) => i.id === lastSelectedId);
        const currIdx = allItems.findIndex((i) => i.id === id);

        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          const rangeIds = allItems.slice(start, end + 1).map((i) => i.id);
          newSelection = Array.from(new Set([...prev, ...rangeIds]));
        } else {
          newSelection = [id];
        }
      } else if (isMultiSelectKey) {
        // Ctrl / Cmd toggle
        newSelection = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      } else {
        // Standard single click: select ONLY the clicked item (like Google Drive)
        newSelection = [id];
      }

      // Update selected item for details panel
      const allItems = [...folders, ...files];
      const item = allItems.find((i) => i.id === id);
      if (item) {
        setSelectedItem(item);
        if (item.type === "FILE") {
          setDetailsActiveTab("preview");
        } else {
          setDetailsActiveTab("details");
        }
      } else {
        setSelectedItem(null);
      }

      return newSelection;
    });
  };

  const handleOpenFilePreviewInPanel = (file: DriveItemWithDetails) => {
    setSelectedItem(file);
    setSelectedIds([file.id]);
    setDetailsActiveTab("preview");
    setIsDetailsOpen(true);
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      const allIds = [...folders, ...files].map((i) => i.id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  // ── Actions: Star, Rename, Move, Trash, Restore ────────────────────────────
  const handleToggleStar = async (item: DriveItemWithDetails) => {
    try {
      const res = await toggleStarDriveItem(item.id);
      if (res.success) {
        toast.success(res.isStarred ? `Starred "${item.name}"` : `Unstarred "${item.name}"`);
        loadContents(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to star item");
    }
  };

  const handleCreateFolder = async (name: string, color?: string) => {
    if (isReadOnlyScope) {
      toast.error("Creating folders is not allowed in this section");
      return;
    }
    try {
      const res = await createDriveFolder({
        name,
        parentId: currentFolderId,
        scope: scope as any,
        color,
      });

      if (res.success) {
        toast.success(`Created folder "${name}"`);
        loadContents(false);
      } else {
        toast.error(res.error || "Failed to create folder");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create folder");
    }
  };

  const handleRenameSubmit = async (id: string, newName: string) => {
    try {
      const res = await renameDriveItem(id, newName);
      if (res.success) {
        toast.success(`Renamed to "${newName}"`);
        loadContents(false);
      } else {
        toast.error(res.error || "Failed to rename item");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to rename item");
    }
  };

  const handleMoveSubmit = async (targetFolderId: string | null, targetScope?: any) => {
    try {
      const ids = moveItemsList.map((i) => i.id);
      const res = await moveDriveItems(ids, targetFolderId, targetScope);
      if (res.success) {
        toast.success(`Moved ${res.count ?? ids.length} ${ids.length === 1 ? "item" : "items"}`);
        setSelectedIds([]);
        loadContents(false);
      } else {
        toast.error(res.error || "Failed to move items");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to move items");
    }
  };

  const handleDropOnTarget = async (targetFolderId: string | null, draggedItemData?: any) => {
    const idsToMove = selectedIds.length > 0 ? selectedIds : draggedItemData ? [draggedItemData.id] : [];
    if (idsToMove.length === 0) return;

    try {
      const res = await moveDriveItems(idsToMove, targetFolderId);
      if (res.success) {
        toast.success(`Moved ${res.count} ${res.count === 1 ? "item" : "items"}`);
        setSelectedIds([]);
        loadContents(false);
      } else {
        toast.error(res.error || "Failed to move items");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to move items");
    }
  };

  const handleTrashItems = async (items: DriveItemWithDetails[]) => {
    try {
      const ids = items.map((i) => i.id);
      const res = await trashDriveItems(ids);
      if (res.success) {
        if (res.unsharedCount && res.unsharedCount > 0) {
          toast.success(`Removed ${res.unsharedCount} ${res.unsharedCount === 1 ? "item" : "items"} from Shared with me`);
        }
        if (res.trashedCount && res.trashedCount > 0) {
          toast.success(`Moved ${res.trashedCount} ${res.trashedCount === 1 ? "item" : "items"} to Trash`);
        }
        if (!res.unsharedCount && !res.trashedCount) {
          toast.success(`Updated ${res.count} ${res.count === 1 ? "item" : "items"}`);
        }
        setSelectedIds([]);
        loadContents(false);
      } else {
        toast.error(res.error || "Failed to remove items");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove items");
    }
  };

  const handleRestoreItems = async (items: DriveItemWithDetails[]) => {
    try {
      const ids = items.map((i) => i.id);
      const res = await restoreDriveItems(ids);
      if (res.success) {
        toast.success(`Restored ${res.count} ${res.count === 1 ? "item" : "items"} from Trash`);
        setSelectedIds([]);
        loadContents(false);
      } else {
        toast.error(res.error || "Failed to restore items");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to restore items");
    }
  };

  const openMoveToTrashConfirm = (items: DriveItemWithDetails[]) => {
    if (!items || items.length === 0) return;
    setMoveToTrashItems(items);
  };

  const handleExecuteMoveToTrash = async () => {
    if (!moveToTrashItems || moveToTrashItems.length === 0) return;
    setIsMovingToTrash(true);
    try {
      await handleTrashItems(moveToTrashItems);
      setMoveToTrashItems(null);
    } finally {
      setIsMovingToTrash(false);
    }
  };

  const openPermanentDeleteConfirm = (items: DriveItemWithDetails[], isEmptyTrash = false) => {
    if (!items || items.length === 0) return;
    setPermanentDeleteItems(items);
    setIsEmptyTrashConfirm(isEmptyTrash);
  };

  const handleExecutePermanentDelete = async () => {
    if (!permanentDeleteItems || permanentDeleteItems.length === 0) return;
    setIsDeletingPermanently(true);
    try {
      const ids = permanentDeleteItems.map((i) => i.id);
      const res = await deleteDriveItemsPermanently(ids);
      if (res.success) {
        toast.success(
          isEmptyTrashConfirm
            ? "Trash emptied successfully"
            : `Permanently deleted ${res.count} item(s)`
        );
        setSelectedIds([]);
        setSelectedItem(null);
        setPermanentDeleteItems(null);
        loadContents(false);
        loadStorageStats();
      } else {
        toast.error(res.error || "Failed to permanently delete items");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete items");
    } finally {
      setIsDeletingPermanently(false);
    }
  };

  const handleDownloadFile = async (file: DriveItemWithDetails) => {
    try {
      const res = await getDriveDownloadUrl(file.id, true);
      if (res.success && res.url) {
        const link = document.createElement("a");
        link.href = res.url;
        link.download = file.name;
        link.click();
      } else {
        toast.error(res.error || "Failed to download file");
      }
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    }
  };

  const handleChangeFolderColor = async (folder: DriveItemWithDetails, color: string | null) => {
    try {
      await updateDriveFolderColor(folder.id, color);
      loadContents(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update color");
    }
  };

  const handleSyncStorage = async () => {
    if (isReadOnlyScope) {
      toast.error("Storage sync is only available in Company Library, Project Documents, and My Drive");
      return;
    }
    if (isSyncingStorage) return;
    setIsSyncingStorage(true);
    const toastId = toast.loading("Scanning MinIO storage for new FTP files...");
    try {
      const targetScope =
        scope === "ORGANIZATION_LIBRARY" || scope === "PROJECT" || scope === "PERSONAL"
          ? (scope as any)
          : "ALL";

      const res = await syncDriveStorage(targetScope);
      if (res.success) {
        if (res.syncedFilesCount > 0) {
          toast.success(
            `Synchronized ${res.syncedFilesCount} new file(s) and ${res.createdFoldersCount} folder(s) from MinIO storage.`,
            { id: toastId }
          );
          if (res.syncedFiles && res.syncedFiles.length > 0) {
            setSyncedResults({
              syncedFiles: res.syncedFiles,
              createdFoldersCount: res.createdFoldersCount,
            });
          }
        } else {
          toast.info("MinIO storage is already in sync. No new files found.", { id: toastId });
        }
        loadContents(false);
        loadStorageStats();
      } else {
        toast.error(res.error || "Failed to sync MinIO storage", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Storage sync failed", { id: toastId });
    } finally {
      setIsSyncingStorage(false);
    }
  };

  const isCurrentFolderEditor = currentFolderInfo
    ? currentFolderInfo.userAccessLevel === "EDITOR" || currentFolderInfo.userAccessLevel === "OWNER" || userRole === "ADMIN" || userRole === "SYSTEM_ADMIN"
    : (scope !== "TRASH" && scope !== "SHARED_WITH_ME" && scope !== "STARRED" && scope !== "RECENT");

  const isReadOnlyScope =
    scope === "TRASH" ||
    scope === "STARRED" ||
    scope === "RECENT" ||
    (scope === "SHARED_WITH_ME" && !isCurrentFolderEditor);
  const isTrashScope = scope === "TRASH";
  const allCurrentItems = [...folders, ...files];
  const selectedItemsList = allCurrentItems.filter((i) => selectedIds.includes(i.id));

  return (
    <div className="flex w-full h-full min-h-0 bg-background overflow-hidden relative select-none">
      {/* 1. Desktop Left Sidebar Navigation */}
      <div className="hidden md:flex h-full shrink-0">
        <DriveSidebar
          currentScope={scope}
          currentFolderId={currentFolderId}
          isCurrentFolderEditor={isCurrentFolderEditor}
          onSelectScope={handleSelectScope}
          isExternal={isExternalUserBool}
          onOpenNewFolder={() => {
            if (isReadOnlyScope) {
              toast.error("Creating folders is not allowed in this section");
              return;
            }
            setIsNewFolderOpen(true);
          }}
          onOpenUpload={(mode = "file") => {
            if (isReadOnlyScope) {
              toast.error("Uploading files is not allowed in this section");
              return;
            }
            setUploadMode(mode);
            setIsUploadOpen(true);
          }}
          onOpenDuplicates={() => setIsDuplicatesOpen(true)}
          storageStats={storageStats}
        />
      </div>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200 bg-card">
            <DriveSidebar
              currentScope={scope}
              currentFolderId={currentFolderId}
              isCurrentFolderEditor={isCurrentFolderEditor}
              onSelectScope={(s) => {
                handleSelectScope(s);
                setIsMobileSidebarOpen(false);
              }}
              isExternal={isExternalUserBool}
              onOpenNewFolder={() => {
                if (isReadOnlyScope) {
                  toast.error("Creating folders is not allowed in this section");
                  return;
                }
                setIsNewFolderOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onOpenUpload={(mode = "file") => {
                if (isReadOnlyScope) {
                  toast.error("Uploading files is not allowed in this section");
                  return;
                }
                setUploadMode(mode);
                setIsUploadOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onOpenDuplicates={() => {
                setIsDuplicatesOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onCloseMobile={() => setIsMobileSidebarOpen(false)}
              className="w-full border-r-0"
              storageStats={storageStats}
            />
          </div>
        </div>
      )}

      {/* 2. Main Content Explorer Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Search & Controls Bar */}
        <DriveTopbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(sb, so) => {
            setSortBy(sb);
            setSortOrder(so);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={() => loadContents(false)}
          isRefreshing={isRefreshing}
          onSyncStorage={handleSyncStorage}
          isSyncingStorage={isSyncingStorage}
          isSyncDisabled={isReadOnlyScope}
          onToggleDetails={() => setIsDetailsOpen(!isDetailsOpen)}
          isDetailsOpen={isDetailsOpen}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Breadcrumb Path Bar */}
        <DriveBreadcrumbs
          currentScope={scope}
          breadcrumbs={breadcrumbs}
          onNavigateFolder={handleNavigateFolder}
          onDropOnBreadcrumb={(targetId) => handleDropOnTarget(targetId)}
          isTrash={isTrashScope}
          onEmptyTrash={canDeletePermanently ? () => openPermanentDeleteConfirm(allCurrentItems, true) : undefined}
          trashedCount={allCurrentItems.length}
          canMove={!isExternalUserBool || isCurrentFolderEditor}
        />

        {/* Dynamic Items Content Area */}
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedIds([]);
              setSelectedItem(null);
            }
          }}
          onDragOver={(e) => {
            if (isReadOnlyScope) return;
            e.preventDefault();
            setIsWindowDragOver(true);
          }}
          onDragLeave={() => setIsWindowDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsWindowDragOver(false);
            if (isReadOnlyScope) {
              toast.error("Uploading files is not allowed in this section");
              return;
            }
            if (e.dataTransfer.files.length > 0) {
              setIsUploadOpen(true);
            }
          }}
          className={cn(
            "flex-1 overflow-y-auto p-4 space-y-6 relative transition-colors",
            isWindowDragOver && "bg-primary/5 ring-2 ring-primary ring-inset"
          )}
        >
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            </div>
          ) : allCurrentItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {searchQuery || typeFilter !== "all"
                  ? "No matching files or folders"
                  : "This folder is empty"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your search keywords or resetting your file type filter."
                  : isReadOnlyScope
                  ? "No items found in this view."
                  : "Upload files or create folders to get started."}
              </p>
              {searchQuery || typeFilter !== "all" ? (
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("all");
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-md gap-1.5 px-3.5 text-xs font-medium cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </Button>
              ) : !isReadOnlyScope ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsUploadOpen(true)}
                    size="sm"
                    className="rounded-full gap-1.5 px-4"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Files</span>
                  </Button>
                  <Button
                    onClick={() => setIsNewFolderOpen(true)}
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5 px-4"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>New Folder</span>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : viewMode === "list" ? (
            /* Table / List View */
            <DriveTableView
              items={allCurrentItems}
              selectedIds={selectedIds}
              isSearchMode={!!searchQuery || typeFilter !== "all"}
              isDetailsOpen={isDetailsOpen}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onOpenFolder={handleOpenFolder}
              onPreviewFile={handleOpenFilePreviewInPanel}
              onDownloadFile={handleDownloadFile}
              onToggleStar={handleToggleStar}
              onRename={(item) => setRenameItem(item)}
              onMove={(item) => setMoveItemsList([item])}
              onShare={(item) => setShareItem(item)}
              onTrash={(item) => (isTrashScope || item.isTrashed ? openPermanentDeleteConfirm([item]) : openMoveToTrashConfirm([item]))}
              onRestore={(item) => handleRestoreItems([item])}
              onChangeColor={handleChangeFolderColor}
              onNavigateToParentFolder={handleNavigateFolder}
              canDelete={(item) => !isExternalUserBool || (!!currentUserId && item.ownerId === currentUserId)}
              canDeletePermanently={canDeletePermanently}
              canRename={(item) => !isExternalUserBool || (!!currentUserId && item.ownerId === currentUserId)}
              canMove={!isExternalUserBool || isCurrentFolderEditor}
            />
          ) : (
            /* Grid View */
            <div className="space-y-6">
              {/* Folders Section */}
              {folders.length > 0 && (
                <div className="space-y-3 w-full">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Folders ({folders.length})</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 w-full">
                    {folders.map((folder) => (
                      <DriveFolderCard
                        key={folder.id}
                        folder={folder}
                        isSelected={selectedIds.includes(folder.id)}
                        onSelect={(e, f) => handleToggleSelect(f.id, e)}
                        onOpen={handleOpenFolder}
                        onToggleStar={handleToggleStar}
                        onRename={(f) => setRenameItem(f)}
                        onMove={(f) => setMoveItemsList([f])}
                        onShare={(f) => setShareItem(f)}
                        onTrash={(f) => (isTrashScope || f.isTrashed ? openPermanentDeleteConfirm([f]) : openMoveToTrashConfirm([f]))}
                        onRestore={(f) => handleRestoreItems([f])}
                        onChangeColor={handleChangeFolderColor}
                        onDropItemsOnFolder={(targetFolderId) => handleDropOnTarget(targetFolderId)}
                        onNavigateToParentFolder={handleNavigateFolder}
                        isSearchMode={!!searchQuery || typeFilter !== "all"}
                        canDelete={!isExternalUserBool || (!!currentUserId && folder.ownerId === currentUserId)}
                        canDeletePermanently={canDeletePermanently}
                        canRename={!isExternalUserBool || (!!currentUserId && folder.ownerId === currentUserId)}
                        canMove={!isExternalUserBool || isCurrentFolderEditor}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {files.length > 0 && (
                <div className="space-y-3 w-full">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Files ({files.length})</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 w-full">
                    {files.map((file) => (
                      <DriveFileCard
                        key={file.id}
                        file={file}
                        isSelected={selectedIds.includes(file.id)}
                        onSelect={(e, f) => handleToggleSelect(f.id, e)}
                        onPreview={handleOpenFilePreviewInPanel}
                        onDownload={handleDownloadFile}
                        onToggleStar={handleToggleStar}
                        onRename={(f) => setRenameItem(f)}
                        onMove={(f) => setMoveItemsList([f])}
                        onShare={(f) => setShareItem(f)}
                        onTrash={(f) => (isTrashScope || f.isTrashed ? openPermanentDeleteConfirm([f]) : openMoveToTrashConfirm([f]))}
                        onRestore={(f) => handleRestoreItems([f])}
                        onNavigateToParentFolder={handleNavigateFolder}
                        isSearchMode={!!searchQuery || typeFilter !== "all"}
                        canDelete={!isExternalUserBool || (!!currentUserId && file.ownerId === currentUserId)}
                        canDeletePermanently={canDeletePermanently}
                        canRename={!isExternalUserBool || (!!currentUserId && file.ownerId === currentUserId)}
                        canMove={!isExternalUserBool || isCurrentFolderEditor}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex flex-col items-center justify-center pt-4 pb-8">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="rounded-full px-6 text-xs gap-2 shadow-xs hover:border-primary hover:text-primary transition-all"
              >
                {isLoadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : (
                  <span>Load More Files ({allCurrentItems.length} of {totalCount})</span>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Floating Multi-Select Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-24 md:absolute md:bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 sm:px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 z-50 text-xs whitespace-nowrap max-w-[95vw] overflow-x-auto">
            <span className="font-semibold">{selectedIds.length} selected</span>
            <div className="h-4 w-px bg-background/20" />

            {!isTrashScope ? (
              <>
                {(!isExternalUserBool || isCurrentFolderEditor) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setMoveItemsList(selectedItemsList)}
                    className="h-7 text-background hover:bg-background/10 rounded-full px-2.5 text-xs gap-1.5"
                  >
                    <FolderInput className="w-3.5 h-3.5" />
                    <span>Move</span>
                  </Button>
                )}
                {(!isExternalUserBool || (!!currentUserId && selectedItemsList.every((i) => i.ownerId === currentUserId))) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openMoveToTrashConfirm(selectedItemsList)}
                    className="h-7 text-rose-400 hover:text-rose-300 hover:bg-background/10 rounded-full px-2.5 text-xs gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Trash</span>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRestoreItems(selectedItemsList)}
                  className="h-7 text-emerald-400 hover:text-emerald-300 hover:bg-background/10 rounded-full px-2.5 text-xs gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </Button>
                {canDeletePermanently && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openPermanentDeleteConfirm(selectedItemsList)}
                    className="h-7 text-rose-400 hover:text-rose-300 hover:bg-background/10 rounded-full px-2.5 text-xs gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Forever</span>
                  </Button>
                )}
              </>
            )}

            <button
              onClick={() => setSelectedIds([])}
              className="text-background/60 hover:text-background text-xs pl-2 font-medium"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* 3. Right Details & Activity Sidebar */}
      <DriveDetailsPanel
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        selectedItem={selectedItem}
        activeTab={detailsActiveTab}
        onTabChange={setDetailsActiveTab}
        onDownload={handleDownloadFile}
        onNavigateToParentFolder={handleNavigateFolder}
      />

      {/* 4. Modals */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onSubmit={handleCreateFolder}
      />

      <RenameModal
        isOpen={!!renameItem}
        onClose={() => setRenameItem(null)}
        item={renameItem}
        onSubmit={handleRenameSubmit}
      />

      <MoveModal
        isOpen={moveItemsList.length > 0}
        onClose={() => setMoveItemsList([])}
        itemsToMove={moveItemsList}
        allFolders={folders}
        onSubmit={handleMoveSubmit}
        isExternal={isExternalUserBool}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentScope={scope}
        currentFolderId={currentFolderId}
        initialUploadMode={uploadMode}
        personalQuota={storageStats?.personalQuota}
        onUploadComplete={() => {
          loadContents(false);
          loadStorageStats();
        }}
      />

      <ShareModal
        isOpen={!!shareItem}
        onClose={() => setShareItem(null)}
        item={shareItem}
      />

      <DuplicatesModal
        isOpen={isDuplicatesOpen}
        onClose={() => setIsDuplicatesOpen(false)}
        userRole={userRole}
        isTeamLeader={isTeamLeader}
        isExternal={isExternalUserBool}
        onCleanupComplete={() => {
          loadContents(false);
          loadStorageStats();
        }}
      />

      {/* 5. Move to Trash Confirmation Alert Dialog */}
      <AlertDialog
        open={!!moveToTrashItems}
        onOpenChange={(open) => {
          if (!open && !isMovingToTrash) {
            setMoveToTrashItems(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
              <Trash2 className="w-5 h-5 text-rose-500 shrink-0" />
              <span>Move to Trash?</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-2.5">
              <span className="block text-foreground text-sm font-medium">
                {moveToTrashItems?.length === 1
                  ? `Are you sure you want to move "${moveToTrashItems[0].name}" to Trash?`
                  : `Are you sure you want to move ${moveToTrashItems?.length || 0} selected items to Trash?`}
              </span>
              <span className="block bg-muted/60 text-muted-foreground border border-border/80 rounded-md p-2.5 text-xs font-normal leading-relaxed">
                Items moved to Trash can be restored at any time or deleted permanently later.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              disabled={isMovingToTrash}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isMovingToTrash}
              onClick={handleExecuteMoveToTrash}
              className="h-8 text-xs gap-1.5 cursor-pointer font-medium bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isMovingToTrash && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Trash2 className="w-3.5 h-3.5" />
              <span>Move to Trash</span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 6. Permanent Delete & Empty Trash Alert Dialog */}
      <AlertDialog
        open={!!permanentDeleteItems}
        onOpenChange={(open) => {
          if (!open && !isDeletingPermanently) {
            setPermanentDeleteItems(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive text-base font-semibold">
              <Trash2 className="w-5 h-5 text-destructive shrink-0" />
              <span>{isEmptyTrashConfirm ? "Empty Trash?" : "Delete Permanently?"}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground pt-1 space-y-2.5">
              <span className="block text-foreground text-sm font-medium">
                {isEmptyTrashConfirm
                  ? `Are you sure you want to permanently delete all ${permanentDeleteItems?.length || 0} item(s) in Trash?`
                  : `Are you sure you want to permanently delete ${
                      permanentDeleteItems?.length === 1
                        ? `"${permanentDeleteItems[0].name}"`
                        : `${permanentDeleteItems?.length || 0} selected item(s)`
                    }?`}
              </span>
              <span className="block bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-2.5 text-xs font-normal leading-relaxed">
                ⚠️ <strong>This action cannot be undone.</strong> The selected items and their associated files in storage will be erased forever.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              disabled={isDeletingPermanently}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeletingPermanently}
              onClick={handleExecutePermanentDelete}
              className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
            >
              {isDeletingPermanently && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEmptyTrashConfirm ? "Empty Trash" : "Delete Permanently"}</span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Newly Synced Files Results Modal */}
      {syncedResults && (
        <SyncResultsModal
          isOpen={!!syncedResults}
          onClose={() => setSyncedResults(null)}
          syncedFiles={syncedResults.syncedFiles}
          createdFoldersCount={syncedResults.createdFoldersCount}
        />
      )}
    </div>
  );
}
