"use client";

import React, { useState } from "react";
import {
  Folder,
  MoreVertical,
  Star,
  Edit2,
  FolderInput,
  Trash2,
  Palette,
  Eye,
  Check,
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DriveFolderCardProps {
  folder: DriveItemWithDetails;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent, folder: DriveItemWithDetails) => void;
  onOpen: (folder: DriveItemWithDetails) => void;
  onToggleStar: (folder: DriveItemWithDetails) => void;
  onRename: (folder: DriveItemWithDetails) => void;
  onMove: (folder: DriveItemWithDetails) => void;
  onTrash?: (folder: DriveItemWithDetails) => void;
  onRestore?: (folder: DriveItemWithDetails) => void;
  onChangeColor: (folder: DriveItemWithDetails, color: string | null) => void;
  onShare?: (folder: DriveItemWithDetails) => void;
  onDropItemsOnFolder?: (targetFolderId: string) => void;
  onNavigateToParentFolder?: (folderId: string | null, targetScope?: any) => void;
  isSearchMode?: boolean;
  canDelete?: boolean;
  canDeletePermanently?: boolean;
  canRename?: boolean;
  canMove?: boolean;
}

export const FOLDER_COLORS = [
  { name: "Default (Slate)", value: null, bg: "bg-slate-500" },
  { name: "Blue", value: "#3b82f6", bg: "bg-blue-500" },
  { name: "Green", value: "#10b981", bg: "bg-emerald-500" },
  { name: "Amber", value: "#f59e0b", bg: "bg-amber-500" },
  { name: "Rose", value: "#f43f5e", bg: "bg-rose-500" },
  { name: "Purple", value: "#8b5cf6", bg: "bg-purple-500" },
  { name: "Indigo", value: "#6366f1", bg: "bg-indigo-500" },
  { name: "Teal", value: "#14b8a6", bg: "bg-teal-500" },
];

export function DriveFolderCard({
  folder,
  isSelected,
  onSelect,
  onOpen,
  onToggleStar,
  onRename,
  onMove,
  onTrash,
  onRestore,
  onChangeColor,
  onShare,
  onDropItemsOnFolder,
  onNavigateToParentFolder,
  isSearchMode = false,
  canDelete = true,
  canDeletePermanently = false,
  canRename = true,
  canMove = true,
}: DriveFolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onClick={(e) => onSelect(e, folder)}
      onDoubleClick={() => onOpen(folder)}
      draggable={canMove}
      onDragStart={(e) => {
        if (!canMove) return;
        e.dataTransfer.setData("text/plain", JSON.stringify({ id: folder.id, type: "FOLDER" }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!canMove) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (!canMove) return;
        e.preventDefault();
        setIsDragOver(false);
        const data = e.dataTransfer.getData("text/plain");
        try {
          const item = JSON.parse(data);
          if (item.id !== folder.id) {
            onDropItemsOnFolder?.(folder.id);
          }
        } catch (err) {
          // not JSON
        }
      }}
      className={cn(
        "group relative flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer select-none bg-card hover:bg-accent/40",
        isSelected
          ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/40"
          : "border-border/60 hover:border-border shadow-2xs hover:shadow-xs",
        isDragOver && "ring-2 ring-primary bg-primary/10 scale-102"
      )}
    >
      {/* Left Folder Icon + Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "w-9 h-9 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
            folder.color ? "" : "bg-slate-500/10 text-slate-600"
          )}
          style={
            folder.color
              ? { backgroundColor: `${folder.color}15`, color: folder.color }
              : undefined
          }
        >
          <Folder className="w-5 h-5 fill-current" />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <p
            className="text-xs font-semibold text-foreground truncate leading-snug group-hover:text-primary transition-colors"
            title={folder.name}
          >
            {folder.name}
          </p>
          <span className="text-[11px] text-muted-foreground truncate">
            {folder.itemCount !== undefined
              ? `${folder.itemCount} ${folder.itemCount === 1 ? "item" : "items"}`
              : "Folder"}
          </span>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-1 shrink-0 ml-1.5" onClick={(e) => e.stopPropagation()}>
        {!folder.isTrashed && (
          <button
            onClick={() => onToggleStar(folder)}
            className={cn(
              "p-1.5 rounded-full hover:bg-accent transition-colors cursor-pointer",
              folder.isStarred
                ? "text-yellow-500 opacity-100"
                : "text-muted-foreground opacity-0 group-hover:opacity-100"
            )}
            title={folder.isStarred ? "Unstar" : "Star"}
          >
            <Star className={cn("w-4 h-4", folder.isStarred && "fill-yellow-500")} />
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-lg">
            <DropdownMenuItem onClick={() => onOpen(folder)} className="text-xs gap-2 cursor-pointer">
              <Eye className="w-3.5 h-3.5" />
              <span>Open</span>
            </DropdownMenuItem>
            {!folder.isTrashed && isSearchMode && onNavigateToParentFolder && (
              <DropdownMenuItem
                onClick={() => onNavigateToParentFolder(folder.parentId, folder.scope as any)}
                className="text-xs gap-2 cursor-pointer"
              >
                <FolderSearch className="w-3.5 h-3.5 text-blue-500" />
                <span>Show Location</span>
              </DropdownMenuItem>
            )}
            {!folder.isTrashed && (
              <DropdownMenuItem onClick={() => onToggleStar(folder)} className="text-xs gap-2 cursor-pointer">
                <Star className={cn("w-3.5 h-3.5", folder.isStarred && "fill-yellow-500 text-yellow-500")} />
                <span>{folder.isStarred ? "Remove from Starred" : "Add to Starred"}</span>
              </DropdownMenuItem>
            )}
            {!folder.isTrashed && onShare && (
              <DropdownMenuItem onClick={() => onShare(folder)} className="text-xs gap-2 cursor-pointer">
                <Share2 className="w-3.5 h-3.5 text-purple-500" />
                <span>Share</span>
              </DropdownMenuItem>
            )}
            {!folder.isTrashed && canRename && (
              <DropdownMenuItem onClick={() => onRename(folder)} className="text-xs gap-2 cursor-pointer">
                <Edit2 className="w-3.5 h-3.5" />
                <span>Rename</span>
              </DropdownMenuItem>
            )}
            {!folder.isTrashed && canMove && (
              <DropdownMenuItem onClick={() => onMove(folder)} className="text-xs gap-2 cursor-pointer">
                <FolderInput className="w-3.5 h-3.5" />
                <span>Move to...</span>
              </DropdownMenuItem>
            )}

            {/* Folder Color Submenu */}
            {!folder.isTrashed && canRename && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs gap-2">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Change Color</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44 rounded-xl p-1.5">
                  <div className="grid grid-cols-4 gap-1.5 p-1">
                    {FOLDER_COLORS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => onChangeColor(folder, c.value)}
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer",
                          c.bg,
                          folder.color === c.value && "ring-2 ring-foreground ring-offset-2"
                        )}
                        title={c.name}
                      >
                        {folder.color === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* Restore option if folder is trashed */}
            {folder.isTrashed && onRestore && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onRestore(folder)}
                  className="text-xs gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </DropdownMenuItem>
              </>
            )}

            {((folder.isTrashed ? canDeletePermanently : canDelete) && onTrash) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onTrash(folder)}
                  className="text-xs gap-2 text-rose-500 hover:text-rose-600 focus:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{folder.isTrashed ? "Delete Forever" : "Move to Trash"}</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
