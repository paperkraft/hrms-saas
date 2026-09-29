"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
  FolderUp,
  FileUp,
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { DriveScopeType } from "../drive-sidebar";
import { cn } from "@/lib/utils";

interface UploadFileItem {
  id: string;
  file: File;
  relativePath: string;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScope: DriveScopeType;
  currentFolderId: string | null;
  initialUploadMode?: "file" | "folder";
  personalQuota?: {
    usedBytes: number;
    quotaBytes: number;
    remainingBytes: number;
    usedPercent: number;
    maxFileSizeBytes: number;
    isExceeded: boolean;
  } | null;
  onUploadComplete: () => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function UploadModal({
  isOpen,
  onClose,
  currentScope,
  currentFolderId,
  initialUploadMode = "file",
  personalQuota,
  onUploadComplete,
}: UploadModalProps) {
  const [queue, setQueue] = useState<UploadFileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, "pending" | "uploading" | "done" | "error">>({});
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const xhrRefs = useRef<Record<string, XMLHttpRequest>>({});
  const isAbortedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setQueue([]);
      setUploadProgress({});
      setUploadStatus({});
      setIsUploading(false);
    }
  }, [isOpen]);

  // ── Drag and Drop Recursive Directory Scanner ──────────────────────────────
  const scanDataTransferItems = async (items: DataTransferItemList): Promise<UploadFileItem[]> => {
    const list: UploadFileItem[] = [];

    async function traverseEntry(entry: any, currentPath = "") {
      if (entry.isFile) {
        const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
        const relPath = `${currentPath}${file.name}`;
        list.push({
          id: `${relPath}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          relativePath: relPath,
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise<any[]>((resolve, reject) => {
          const collected: any[] = [];
          function readBatch() {
            dirReader.readEntries((batch: any[]) => {
              if (!batch || batch.length === 0) {
                resolve(collected);
              } else {
                collected.push(...batch);
                readBatch();
              }
            }, reject);
          }
          readBatch();
        });

        for (const child of entries) {
          await traverseEntry(child, `${currentPath}${entry.name}/`);
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        await traverseEntry(entry);
      } else {
        const file = item.getAsFile();
        if (file) {
          list.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
            file,
            relativePath: file.name,
          });
        }
      }
    }

    return list;
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newItems: UploadFileItem[] = Array.from(files).map((file) => ({
      id: `${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.items) {
      try {
        const items = await scanDataTransferItems(e.dataTransfer.items);
        setQueue((prev) => [...prev, ...items]);
      } catch (err) {
        console.error("Error scanning dropped files:", err);
        handleFilesSelected(e.dataTransfer.files);
      }
    } else {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  };

  // ── Upload Execution ───────────────────────────────────────────────────────
  const handleStartUpload = async () => {
    if (queue.length === 0 || isUploading) return;

    setIsUploading(true);
    isAbortedRef.current = false;

    const initialProgress: Record<string, number> = {};
    const initialStatus: Record<string, "pending" | "uploading" | "done" | "error"> = {};

    queue.forEach((item) => {
      initialProgress[item.id] = 0;
      initialStatus[item.id] = "pending";
    });

    setUploadProgress(initialProgress);
    setUploadStatus(initialStatus);

    let successCount = 0;

    for (const item of queue) {
      if (isAbortedRef.current) break;

      setUploadStatus((prev) => ({ ...prev, [item.id]: "uploading" }));

      try {
        // 1. Get Presigned URL with size check
        const folderParam = currentFolderId ? `&folderId=${encodeURIComponent(currentFolderId)}` : "";
        const presignedRes = await fetch(
          `/api/drive/presigned-url?filename=${encodeURIComponent(item.file.name)}&contentType=${encodeURIComponent(
            item.file.type || "application/octet-stream"
          )}&size=${item.file.size}&scope=${encodeURIComponent(currentScope)}${folderParam}`
        );

        const presignedData = await presignedRes.json();
        if (!presignedRes.ok || !presignedData.success) {
          throw new Error(presignedData.error || "Failed to generate presigned URL");
        }

        const { presignedUrl, objectName } = presignedData;

        // 2. Upload to MinIO with progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRefs.current[item.id] = xhr;

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress((prev) => ({ ...prev, [item.id]: percent }));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

          xhr.open("PUT", presignedUrl);
          xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
          xhr.send(item.file);
        });

        // 3. Confirm upload in DriveItem DB with relativePath for automatic folder hierarchy
        const confirmRes = await fetch("/api/drive/confirm-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.file.name,
            objectName,
            size: item.file.size,
            mimeType: item.file.type || "application/octet-stream",
            scope: currentScope,
            parentId: currentFolderId,
            relativePath: item.relativePath,
          }),
        });

        const confirmData = await confirmRes.json();
        if (!confirmRes.ok || !confirmData.success) {
          throw new Error(confirmData.error || "Failed to register file record");
        }

        setUploadProgress((prev) => ({ ...prev, [item.id]: 100 }));
        setUploadStatus((prev) => ({ ...prev, [item.id]: "done" }));
        successCount++;
      } catch (err: any) {
        console.error(`Error uploading ${item.file.name}:`, err);
        setUploadStatus((prev) => ({ ...prev, [item.id]: "error" }));
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} ${successCount === 1 ? "file" : "files"}`);
      onUploadComplete();
      setQueue([]);
      onClose();
    } else {
      toast.error("Failed to upload files");
    }
  };

  const hasNestedFolders = queue.some((i) => i.relativePath.includes("/"));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-lg bg-card border shadow-xl">
        <DialogHeader className="px-6 py-5 border-b bg-muted/20 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Upload to {currentScope === "ORGANIZATION_LIBRARY" ? "Company Library" : currentScope === "PROJECT" ? "Project Documents" : "My Drive"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Select individual files or upload entire folders with nested subdirectories.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Dual Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all bg-muted/20 text-center",
              isDragOver && "border-primary bg-primary/5"
            )}
          >
            <div className="w-11 h-11 rounded-md bg-primary/10 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-primary" />
            </div>

            <p className="text-xs font-semibold text-foreground">
              Drag & drop files or folders here
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 mb-4">
              Folder hierarchies and nested subfolders are preserved automatically
            </p>

            {/* Hidden File and Folder Inputs */}
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <input
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              ref={folderInputRef}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md text-xs gap-1.5 h-8 px-3 cursor-pointer hover:border-primary hover:text-primary transition-colors"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Choose Files</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                className="rounded-md text-xs gap-1.5 h-8 px-3 cursor-pointer hover:border-primary hover:text-primary transition-colors bg-primary/5 border-primary/30 text-primary"
              >
                <FolderUp className="w-3.5 h-3.5" />
                <span>Choose Folder</span>
              </Button>
            </div>
          </div>

          {/* Queue List */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                <span className="flex items-center gap-1.5">
                  <span>Queued ({queue.length} {queue.length === 1 ? "item" : "items"})</span>
                  {hasNestedFolders && (
                    <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
                      Folder Hierarchy Detected
                    </span>
                  )}
                </span>
                <span>
                  {formatBytes(queue.reduce((acc, curr) => acc + curr.file.size, 0))}
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 divide-y divide-border/40 bg-muted/20 p-2 rounded-md border border-border/50">
                {queue.map((item) => {
                  const status = uploadStatus[item.id] || "pending";
                  const percent = uploadProgress[item.id] || 0;
                  const isNested = item.relativePath.includes("/");
                  const folderPath = isNested ? item.relativePath.substring(0, item.relativePath.lastIndexOf("/")) : null;

                  return (
                    <div key={item.id} className="pt-1.5 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isNested ? (
                            <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{item.file.name}</p>
                            {folderPath && (
                              <p className="text-[10px] text-muted-foreground truncate font-mono">
                                📁 {folderPath}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatBytes(item.file.size)}
                          </span>

                          {status === "uploading" && (
                            <span className="text-[10px] text-primary font-bold">{percent}%</span>
                          )}
                          {status === "done" && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                          {status === "error" && (
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          )}

                          {!isUploading && status === "pending" && (
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-muted-foreground hover:text-rose-500 p-0.5 rounded-md transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {status === "uploading" && (
                        <Progress value={percent} className="h-1 bg-muted rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Quota & Size Validation Alerts */}
          {(() => {
            const maxFileSize = personalQuota?.maxFileSizeBytes || (100 * 1024 * 1024);
            const queueTotalSize = queue.reduce((acc, curr) => acc + curr.file.size, 0);
            const hasOversizedFile = queue.some(item => item.file.size > maxFileSize);
            const isPersonalQuotaExceeded = currentScope === "PERSONAL" && personalQuota && (queueTotalSize > personalQuota.remainingBytes);

            return (
              <>
                {hasOversizedFile && (
                  <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>One or more files exceed the single file limit of {formatBytes(maxFileSize)}.</span>
                  </div>
                )}
                {isPersonalQuotaExceeded && (
                  <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Upload size ({formatBytes(queueTotalSize)}) exceeds available storage ({formatBytes(personalQuota.remainingBytes)} free).</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-md text-xs h-9 px-4"
          >
            Cancel
          </Button>

          {(() => {
            const maxFileSize = personalQuota?.maxFileSizeBytes || (100 * 1024 * 1024);
            const queueTotalSize = queue.reduce((acc, curr) => acc + curr.file.size, 0);
            const hasOversizedFile = queue.some(item => item.file.size > maxFileSize);
            const isPersonalQuotaExceeded = currentScope === "PERSONAL" && personalQuota && (queueTotalSize > personalQuota.remainingBytes);
            const isBlocked = queue.length === 0 || isUploading || hasOversizedFile || Boolean(isPersonalQuotaExceeded);

            return (
              <Button
                type="button"
                onClick={handleStartUpload}
                disabled={isBlocked}
                className="rounded-md text-xs px-6 h-9 font-medium gap-1.5"
              >
                {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isUploading
                    ? "Uploading..."
                    : queue.length > 0
                    ? `Upload ${queue.length} ${queue.length === 1 ? "Item" : "Items"}`
                    : "Upload"}
                </span>
              </Button>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
