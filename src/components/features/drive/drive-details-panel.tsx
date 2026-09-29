"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  X,
  FileText,
  Folder,
  User,
  Clock,
  Download,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { DriveItemWithDetails, getDriveActivityLogs, getDriveDownloadUrl } from "@/actions/drive";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExcelViewer } from "@/components/features/library/excel-viewer";
import { getFileTypeIcon } from "./drive-file-card";
import { cn } from "@/lib/utils";

interface DriveDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: DriveItemWithDetails | null;
  activeTab?: "preview" | "details" | "activity";
  onTabChange?: (tab: "preview" | "details" | "activity") => void;
  onDownload?: (file: DriveItemWithDetails) => void;
  onNavigateToParentFolder?: (folderId: string | null, targetScope?: any) => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DriveDetailsPanel({
  isOpen,
  onClose,
  selectedItem,
  activeTab = "details",
  onTabChange,
  onDownload,
  onNavigateToParentFolder,
}: DriveDetailsPanelProps) {
  const [currentTab, setCurrentTab] = useState<string>(activeTab);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Live File Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Sync external tab changes
  useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  // Fetch download/preview URL when selected item changes
  useEffect(() => {
    if (!isOpen || !selectedItem || selectedItem.type !== "FILE") {
      setPreviewUrl(null);
      setPreviewError(null);
      return;
    }

    let isMounted = true;
    async function fetchUrl() {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const res = await getDriveDownloadUrl(selectedItem!.id);
        if (isMounted) {
          if (res.success && res.url) {
            setPreviewUrl(res.url);
          } else {
            setPreviewError(res.error || "Failed to generate preview URL");
          }
        }
      } catch (err: any) {
        if (isMounted) setPreviewError(err.message || "Failed to load preview");
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    }

    fetchUrl();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedItem?.id]);

  // Fetch activities
  useEffect(() => {
    if (!isOpen || !selectedItem) {
      setActivities([]);
      return;
    }

    let isMounted = true;
    async function loadLogs() {
      setLoadingActivities(true);
      try {
        const res = await getDriveActivityLogs(selectedItem?.id);
        if (isMounted && res.success && res.logs) {
          setActivities(res.logs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingActivities(false);
      }
    }

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedItem?.id]);

  if (!isOpen) return null;

  if (!selectedItem) {
    return (
      <>
        {/* Mobile Backdrop */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
        />
        <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-90 lg:static lg:z-20 lg:w-72 xl:w-80 border-l bg-card/95 backdrop-blur-md flex flex-col h-full shrink-0 select-none transition-all shadow-2xl lg:shadow-none animate-in slide-in-from-right duration-200">
          {/* Header with Close button */}
          <div className="h-12 px-3.5 border-b flex items-center justify-between gap-2 shrink-0 bg-muted/20">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Folder className="size-4 text-muted-foreground" />
              Item Details
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full size-7 cursor-pointer hover:bg-muted"
              title="Close panel"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Empty State Body */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="size-14 rounded-full bg-muted/60 border border-border/80 flex items-center justify-center mb-3.5 text-muted-foreground shadow-2xs">
              <Folder className="size-6 text-muted-foreground/80" />
            </div>
            <h4 className="text-sm font-bold text-foreground">No Item Selected</h4>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-56 leading-relaxed">
              Tap or click any file or folder in the list to view its live preview, details, and activity log.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="mt-5 rounded-md text-xs font-semibold h-8 px-4 border-border/80 hover:bg-primary/5 hover:text-primary cursor-pointer lg:hidden"
            >
              Back to Explorer
            </Button>
          </div>
        </aside>
      </>
    );
  }

  const isFolder = selectedItem.type === "FOLDER";
  const typeConfig = isFolder ? null : getFileTypeIcon(selectedItem.mimeType, selectedItem.extension);
  const Icon = isFolder ? Folder : typeConfig!.icon;

  const ext = selectedItem.extension?.toLowerCase() || "";
  const mime = selectedItem.mimeType?.toLowerCase() || "";

  const isExcel =
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("sheet") ||
    ["xls", "xlsx", "csv"].includes(ext);

  const isPdf = mime.includes("pdf") || ext === "pdf";
  const isImage = mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
  const isVideo = mime.startsWith("video/") || ["mp4", "webm", "ogg"].includes(ext);
  const isAudio = mime.startsWith("audio/") || ["mp3", "wav", "aac"].includes(ext);
  const isText = mime.startsWith("text/") || ["txt", "md", "json", "js", "ts", "py", "html", "css"].includes(ext);

  const handleTabSelect = (tab: string) => {
    setCurrentTab(tab);
    onTabChange?.(tab as any);
  };

  const isOfficeDoc =
    !isExcel &&
    (mime.includes("word") ||
      mime.includes("powerpoint") ||
      mime.includes("officedocument") ||
      ["doc", "docx", "ppt", "pptx", "rtf", "odt"].includes(ext));

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-90 lg:static lg:z-20 lg:w-72 xl:w-80 border-l bg-card/95 backdrop-blur-md flex flex-col h-full shrink-0 select-none transition-all shadow-2xl lg:shadow-none animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-12 px-3 border-b flex items-center justify-between gap-2 shrink-0 bg-muted/20">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon
              className={cn("w-4 h-4 shrink-0", isFolder ? "text-primary" : typeConfig?.color)}
              style={isFolder && selectedItem.color ? { color: selectedItem.color } : undefined}
            />
            <h3 className="text-xs font-semibold text-foreground truncate" title={selectedItem.name}>
              {selectedItem.name}
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isFolder && previewUrl && (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="rounded-full w-7 h-7 cursor-pointer"
                  title="Open in new tab"
                >
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload?.(selectedItem);
                  }}
                  className="rounded-full w-7 h-7 cursor-pointer"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded-full w-7 h-7 ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={currentTab} onValueChange={handleTabSelect} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-2.5 pb-1 border-b bg-card">
            <TabsList className={cn("grid w-full h-8 rounded-lg bg-muted/60", isFolder ? "grid-cols-2" : "grid-cols-3")}>
              {!isFolder && <TabsTrigger value="preview" className="text-xs rounded-md">Preview</TabsTrigger>}
              <TabsTrigger value="details" className="text-xs rounded-md">Details</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs rounded-md">Activity</TabsTrigger>
            </TabsList>
          </div>

          {/* 1. Live Preview Tab */}
          {!isFolder && (
            <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col p-3 m-0 bg-muted/10 min-h-0">
              {loadingPreview ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Loading preview...</p>
                </div>
              ) : previewError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                  <p className="text-xs font-semibold text-foreground">Preview Error</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{previewError}</p>
                </div>
              ) : !previewUrl ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                  No preview available
                </div>
              ) : isPdf ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full rounded-lg border bg-white shadow-2xs"
                  title={selectedItem.name}
                />
              ) : isOfficeDoc ? (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                  className="w-full h-full rounded-lg border bg-white shadow-2xs"
                  title={selectedItem.name}
                />
              ) : isExcel ? (
                <div className="w-full h-full rounded-lg border bg-white overflow-hidden shadow-2xs">
                  <ExcelViewer url={previewUrl} />
                </div>
              ) : isImage ? (
                <div className="w-full h-full flex items-center justify-center p-2 overflow-auto bg-black/5 rounded-xl border">
                  <img
                    src={previewUrl}
                    alt={selectedItem.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : isVideo ? (
                <div className="w-full h-full flex items-center justify-center p-2 bg-black rounded-xl">
                  <video
                    controls
                    src={previewUrl}
                    className="max-w-full max-h-full rounded-lg"
                  />
                </div>
              ) : isAudio ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 bg-card rounded-xl border">
                  <Icon className="w-12 h-12 text-amber-500 animate-pulse" />
                  <audio controls src={previewUrl} className="w-full max-w-70" />
                </div>
              ) : isText ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full rounded-lg border bg-white p-3 font-mono text-xs shadow-2xs"
                  title={selectedItem.name}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-card rounded-lg border">
                  <FileText className="w-12 h-12 text-muted-foreground/60 mb-2" />
                  <p className="text-xs font-semibold text-foreground">No Direct Preview</p>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-4">
                    Format ({selectedItem.extension?.toUpperCase() || "File"}) cannot be previewed in panel.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => onDownload?.(selectedItem)}
                    className="rounded-full text-xs gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {/* 2. Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
            {/* Visual Mini Banner */}
            <div
              className={cn(
                "h-28 rounded-lg flex flex-col items-center justify-center relative overflow-hidden border",
                isFolder ? "bg-slate-500/10 border-slate-500/20" : cn(typeConfig?.bg, "border-border/40")
              )}
            >
              <Icon
                className={cn("w-10 h-10", isFolder ? "text-slate-600" : typeConfig?.color)}
                style={isFolder && selectedItem.color ? { color: selectedItem.color } : undefined}
              />
              <span className="text-xs font-semibold mt-1.5 text-foreground/80">
                {isFolder ? "Folder" : selectedItem.extension?.toUpperCase() || "File"}
              </span>
            </div>

            {/* Properties List */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                Properties
              </h4>

              <div className="space-y-2 bg-muted/20 p-3 rounded-lg border border-muted-foreground/10">
                <div className="flex justify-between items-start py-0.5 gap-2">
                  <span className="text-muted-foreground shrink-0">Name</span>
                  <span className="font-medium text-foreground text-right break-all text-[11px]" title={selectedItem.name}>
                    {selectedItem.name}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Location</span>
                  <button
                    type="button"
                    onClick={() => onNavigateToParentFolder?.(selectedItem.parentId, selectedItem.scope as any)}
                    className="flex items-center gap-1 font-medium text-primary hover:underline cursor-pointer"
                    title="Click to open containing folder"
                  >
                    <Folder className="w-3 h-3 text-primary shrink-0" />
                    <span className="truncate max-w-42.5">{selectedItem.parentName || "Root"}</span>
                  </button>
                </div>

                {isFolder ? (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-muted-foreground">Contains</span>
                    <span className="font-medium text-foreground">
                      {selectedItem.itemCount !== undefined
                        ? `${selectedItem.itemCount} ${selectedItem.itemCount === 1 ? "item" : "items"}`
                        : "0 items"}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium text-foreground font-mono">
                      {formatBytes(selectedItem.size)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Owner</span>
                  <div className="flex items-center gap-1 font-medium text-foreground">
                    <User className="w-3 h-3 text-primary" />
                    <span>{selectedItem.ownerName}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(selectedItem.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Modified</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(selectedItem.updatedAt), "MMM d, yyyy h:mm a")}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Starred</span>
                  <span className="font-medium text-foreground">
                    {selectedItem.isStarred ? "Yes ⭐" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 3. Activity Tab */}
          <TabsContent value="activity" className="flex-1 overflow-y-auto p-4 m-0">
            {loadingActivities ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <p className="text-xs">Loading activity...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No recent activity recorded</p>
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-foreground/20">
                {activities.map((act) => (
                  <div key={act.id} className="relative pl-7 text-xs space-y-1">
                    <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-card" />
                    <p className="font-semibold text-foreground">{act.action}</p>
                    <p className="text-muted-foreground text-[11px]">{act.details || "Item updated"}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 pt-0.5">
                      <span>{act.user?.name || "System"}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </aside>
    </>
  );
}
