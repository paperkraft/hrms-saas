"use client";

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileArchive,
  Film,
  Music,
  FileCode,
  File,
  MoreVertical,
  Star,
  Download,
  Eye,
  Edit2,
  FolderInput,
  Trash2,
  Share2,
  RotateCcw,
  FolderSearch,
} from "lucide-react";
import { DriveItemWithDetails } from "@/actions/drive";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DriveFileCardProps {
  file: DriveItemWithDetails;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, file: DriveItemWithDetails) => void;
  onPreview: (file: DriveItemWithDetails) => void;
  onDownload: (file: DriveItemWithDetails) => void;
  onToggleStar: (file: DriveItemWithDetails) => void;
  onRename: (file: DriveItemWithDetails) => void;
  onMove: (file: DriveItemWithDetails) => void;
  onTrash?: (file: DriveItemWithDetails) => void;
  onRestore?: (file: DriveItemWithDetails) => void;
  onShare?: (file: DriveItemWithDetails) => void;
  onNavigateToParentFolder?: (folderId: string | null, targetScope?: any) => void;
  isSearchMode?: boolean;
  canDelete?: boolean;
  canDeletePermanently?: boolean;
  canRename?: boolean;
  canMove?: boolean;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getFileTypeIcon(mimeType: string | null, ext: string | null) {
  const mime = mimeType?.toLowerCase() || "";
  const extension = ext?.toLowerCase() || "";

  if (mime.includes("pdf") || extension === "pdf") {
    return {
      icon: FileText,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      badge: "PDF",
      badgeBg: "bg-rose-500 text-white",
    };
  }
  if (
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("sheet") ||
    ["xls", "xlsx", "csv"].includes(extension)
  ) {
    return {
      icon: FileSpreadsheet,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      badge: "XLS",
      badgeBg: "bg-emerald-500 text-white",
    };
  }
  if (
    mime.includes("word") ||
    mime.includes("wordprocessing") ||
    mime.includes("document") ||
    ["doc", "docx", "txt", "rtf"].includes(extension)
  ) {
    return {
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      badge: "DOC",
      badgeBg: "bg-blue-500 text-white",
    };
  }
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(extension)) {
    return {
      icon: ImageIcon,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      badge: extension.toUpperCase() || "IMG",
      badgeBg: "bg-purple-500 text-white",
    };
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(extension)) {
    return {
      icon: Film,
      color: "text-red-500",
      bg: "bg-red-500/10",
      badge: "VIDEO",
      badgeBg: "bg-red-500 text-white",
    };
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "aac", "ogg"].includes(extension)) {
    return {
      icon: Music,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      badge: "AUDIO",
      badgeBg: "bg-amber-500 text-white",
    };
  }
  if (
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("rar") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(extension)
  ) {
    return {
      icon: FileArchive,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      badge: "ZIP",
      badgeBg: "bg-orange-500 text-white",
    };
  }
  if (["js", "ts", "jsx", "tsx", "html", "css", "json", "py", "sql"].includes(extension)) {
    return {
      icon: FileCode,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
      badge: extension.toUpperCase(),
      badgeBg: "bg-cyan-500 text-white",
    };
  }

  return {
    icon: File,
    color: "text-slate-500",
    bg: "bg-slate-500/10",
    badge: extension.toUpperCase() || "FILE",
    badgeBg: "bg-slate-500 text-white",
  };
}

export function DriveFileCard({
  file,
  isSelected,
  onSelect,
  onPreview,
  onDownload,
  onToggleStar,
  onRename,
  onMove,
  onTrash,
  onRestore,
  onShare,
  onNavigateToParentFolder,
  isSearchMode = false,
  canDelete = true,
  canDeletePermanently = false,
  canRename = true,
  canMove = true,
}: DriveFileCardProps) {
  const typeConfig = getFileTypeIcon(file.mimeType, file.extension);
  const Icon = typeConfig.icon;

  return (
    <div
      onClick={(e) => onSelect(e, file)}
      onDoubleClick={() => onPreview(file)}
      draggable={canMove}
      onDragStart={(e) => {
        if (!canMove) return;
        e.dataTransfer.setData("text/plain", JSON.stringify({ id: file.id, type: "FILE" }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group relative flex flex-col rounded-lg border transition-all duration-200 cursor-pointer select-none bg-card overflow-hidden hover:bg-accent/30",
        isSelected
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
          : "border-border/60 hover:border-border shadow-2xs hover:shadow-xs"
      )}
    >
      {/* File Preview Banner */}
      <div
        className={cn(
          "h-32 w-full flex items-center justify-center relative overflow-hidden transition-colors border-b border-border/40",
          typeConfig.bg
        )}
      >
        <Icon className={cn("w-12 h-12 transition-transform group-hover:scale-110", typeConfig.color)} />

        {/* Extension Badge */}
        <span
          className={cn(
            "absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase shadow-xs",
            typeConfig.badgeBg
          )}
        >
          {typeConfig.badge}
        </span>

        {/* Star Button */}
        {!file.isTrashed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(file);
            }}
            className={cn(
              "absolute top-2.5 right-2.5 p-1.5 rounded-full bg-background/80 backdrop-blur-xs transition-opacity hover:bg-background shadow-2xs cursor-pointer",
              file.isStarred ? "text-yellow-500 opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground"
            )}
            title={file.isStarred ? "Unstar" : "Star"}
          >
            <Star className={cn("w-3.5 h-3.5", file.isStarred && "fill-yellow-500")} />
          </button>
        )}
      </div>

      {/* File Info */}
      <div className="p-3 flex flex-col gap-2 min-w-0 bg-card">
        <div className="flex items-start justify-between gap-1.5 min-w-0">
          <p
            className="text-xs font-semibold text-foreground line-clamp-2 leading-snug wrap-break-word group-hover:text-primary transition-colors flex-1 min-h-8"
            title={file.name}
          >
            {file.name}
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-1 -mr-1 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-lg">
              <DropdownMenuItem onClick={() => onPreview(file)} className="text-xs gap-2 cursor-pointer">
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload(file)} className="text-xs gap-2 cursor-pointer">
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </DropdownMenuItem>
              {!file.isTrashed && isSearchMode && onNavigateToParentFolder && (
                <DropdownMenuItem
                  onClick={() => onNavigateToParentFolder(file.parentId, file.scope as any)}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <FolderSearch className="w-3.5 h-3.5 text-blue-500" />
                  <span>Show Location</span>
                </DropdownMenuItem>
              )}
              {!file.isTrashed && onShare && (
                <DropdownMenuItem onClick={() => onShare(file)} className="text-xs gap-2 cursor-pointer">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </DropdownMenuItem>
              )}
              {!file.isTrashed && (
                <DropdownMenuItem onClick={() => onToggleStar(file)} className="text-xs gap-2 cursor-pointer">
                  <Star className={cn("w-3.5 h-3.5", file.isStarred && "fill-yellow-500 text-yellow-500")} />
                  <span>{file.isStarred ? "Remove from Starred" : "Add to Starred"}</span>
                </DropdownMenuItem>
              )}
              {!file.isTrashed && canRename && (
                <DropdownMenuItem onClick={() => onRename(file)} className="text-xs gap-2 cursor-pointer">
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </DropdownMenuItem>
              )}
              {!file.isTrashed && canMove && (
                <DropdownMenuItem onClick={() => onMove(file)} className="text-xs gap-2 cursor-pointer">
                  <FolderInput className="w-3.5 h-3.5" />
                  <span>Move to...</span>
                </DropdownMenuItem>
              )}

              {/* Restore option if file is trashed */}
              {file.isTrashed && onRestore && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onRestore(file)}
                    className="text-xs gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </DropdownMenuItem>
                </>
              )}

              {((file.isTrashed ? canDeletePermanently : canDelete) && onTrash) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onTrash(file)}
                    className="text-xs gap-2 text-rose-500 hover:text-rose-600 focus:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{file.isTrashed ? "Delete Forever" : "Move to Trash"}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
          <span>{formatBytes(file.size)}</span>
          <span className="truncate max-w-22.5">{file.ownerName}</span>
        </div>
      </div>
    </div>
  );
}
