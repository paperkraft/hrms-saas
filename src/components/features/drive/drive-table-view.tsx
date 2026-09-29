"use client";

import React from "react";
import { format } from "date-fns";
import {
  Folder,
  Star,
  Download,
  Eye,
  Edit2,
  FolderInput,
  Trash2,
  MoreVertical,
  Share2,
  FolderSearch,
  ChevronRight,
  Palette,
  Check,
  RotateCcw,
} from "lucide-react";
import { DriveItemWithDetails } from "@/actions/drive";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { getFileTypeIcon } from "./drive-file-card";
import { FOLDER_COLORS } from "./drive-folder-card";
import { cn } from "@/lib/utils";

interface DriveTableViewProps {
  items: DriveItemWithDetails[];
  selectedIds: string[];
  isSearchMode?: boolean;
  isDetailsOpen?: boolean;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onSelectAll: (selected: boolean) => void;
  onOpenFolder: (folder: DriveItemWithDetails) => void;
  onPreviewFile: (file: DriveItemWithDetails) => void;
  onDownloadFile: (file: DriveItemWithDetails) => void;
  onToggleStar: (item: DriveItemWithDetails) => void;
  onRename: (item: DriveItemWithDetails) => void;
  onMove: (item: DriveItemWithDetails) => void;
  onTrash?: (item: DriveItemWithDetails) => void;
  onRestore?: (item: DriveItemWithDetails) => void;
  onChangeColor?: (folder: DriveItemWithDetails, color: string | null) => void;
  onShare?: (item: DriveItemWithDetails) => void;
  onNavigateToParentFolder?: (folderId: string | null, targetScope?: any) => void;
  canDelete?: boolean | ((item: DriveItemWithDetails) => boolean);
  canDeletePermanently?: boolean;
  canRename?: boolean | ((item: DriveItemWithDetails) => boolean);
  canMove?: boolean | ((item: DriveItemWithDetails) => boolean);
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return "—";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function DriveTableView({
  items,
  selectedIds,
  isSearchMode = false,
  isDetailsOpen = false,
  onToggleSelect,
  onSelectAll,
  onOpenFolder,
  onPreviewFile,
  onDownloadFile,
  onToggleStar,
  onRename,
  onMove,
  onTrash,
  onRestore,
  onChangeColor,
  onShare,
  onNavigateToParentFolder,
  canDelete = true,
  canDeletePermanently = false,
  canRename = true,
  canMove = true,
}: DriveTableViewProps) {
  const isAllSelected = items.length > 0 && items.every((i) => selectedIds.includes(i.id));

  return (
    <div className="rounded-lg border bg-card overflow-hidden shadow-2xs w-full">
      <Table className="table-fixed w-full">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent border-b">
            <TableHead className="w-9 px-2.5 shrink-0">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="w-7 px-1 text-center shrink-0"></TableHead>
            <TableHead className="font-semibold text-xs text-foreground w-auto min-w-0">Name</TableHead>
            <TableHead className="hidden sm:table-cell font-semibold text-xs text-foreground w-28 md:w-32">
              Owner
            </TableHead>
            <TableHead className="hidden md:table-cell font-semibold text-xs text-foreground w-36">
              Last Modified
            </TableHead>
            <TableHead className="font-semibold text-xs text-foreground w-20 sm:w-24 text-right">Size</TableHead>
            <TableHead className="w-10 px-2 text-right shrink-0"></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {items.map((item) => {
            const isFolder = item.type === "FOLDER";
            const isSelected = selectedIds.includes(item.id);
            const typeConfig = isFolder ? null : getFileTypeIcon(item.mimeType, item.extension);
            const Icon = isFolder ? Folder : typeConfig!.icon;

            return (
              <TableRow
                key={item.id}
                data-state={isSelected ? "selected" : undefined}
                className={cn(
                  "group transition-colors cursor-pointer select-none border-b",
                  isSelected
                    ? "bg-primary/10 hover:bg-primary/15"
                    : "hover:bg-muted/40"
                )}
                onClick={(e) => {
                  onToggleSelect(item.id, e);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isFolder) {
                    onOpenFolder(item);
                  } else {
                    onPreviewFile(item);
                  }
                }}
              >
                {/* Checkbox */}
                <TableCell
                  className="w-9 px-2.5 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(item.id, e);
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    aria-label={`Select ${item.name}`}
                    className="transition-opacity"
                  />
                </TableCell>

                {/* Star Toggle */}
                <TableCell
                  className="w-7 px-1 text-center shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onToggleStar(item)}
                    className={cn(
                      "p-1 rounded-full transition-opacity cursor-pointer",
                      item.isStarred
                        ? "opacity-100 text-yellow-500 hover:text-yellow-600"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                    )}
                    title={item.isStarred ? "Unstar" : "Star"}
                  >
                    <Star
                      className={cn("w-3.5 h-3.5", item.isStarred && "fill-yellow-500 text-yellow-500")}
                    />
                  </button>
                </TableCell>

                {/* Name & Icon */}
                <TableCell className="font-medium text-xs py-2 w-auto min-w-0 pr-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                        isFolder
                          ? "bg-slate-500/10 text-slate-600"
                          : cn(typeConfig?.bg, typeConfig?.color)
                      )}
                      style={
                        isFolder && item.color
                          ? { backgroundColor: `${item.color}15`, color: item.color }
                          : undefined
                      }
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className="truncate font-medium text-foreground group-hover:text-primary transition-colors"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      {isSearchMode && item.parentName && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                          <Folder className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
                          <span className="truncate">{item.parentName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Owner */}
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground py-2 truncate w-28 md:w-32">
                  <span className="truncate">{item.ownerName || "—"}</span>
                </TableCell>

                {/* Modified Date */}
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground py-2 whitespace-nowrap w-36">
                  {format(new Date(item.updatedAt), "MMM d, yyyy")}
                </TableCell>

                {/* Size */}
                <TableCell className="text-xs text-muted-foreground py-2 text-right font-mono whitespace-nowrap w-20 sm:w-24">
                  {isFolder
                    ? item.itemCount !== undefined
                      ? `${item.itemCount} ${item.itemCount === 1 ? "item" : "items"}`
                      : "—"
                    : formatBytes(item.size)}
                </TableCell>

                {/* Row Context Menu */}
                <TableCell
                  className="w-10 px-2 text-right shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Actions"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 text-xs">
                      {isFolder ? (
                        <DropdownMenuItem onClick={() => onOpenFolder(item)} className="gap-2 cursor-pointer">
                          <Folder className="w-3.5 h-3.5 text-primary" />
                          <span>Open Folder</span>
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => onPreviewFile(item)} className="gap-2 cursor-pointer">
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            <span>Preview</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownloadFile(item)} className="gap-2 cursor-pointer">
                            <Download className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Download</span>
                          </DropdownMenuItem>
                        </>
                      )}

                      {/* Go to Folder action - Only visible in search mode */}
                      {isSearchMode && !item.isTrashed && onNavigateToParentFolder && (
                        <DropdownMenuItem
                          onClick={() => onNavigateToParentFolder(item.parentId, item.scope as any)}
                          className="gap-2 cursor-pointer"
                        >
                          <FolderSearch className="w-3.5 h-3.5 text-blue-500" />
                          <span>Show Location</span>
                        </DropdownMenuItem>
                      )}

                      {!item.isTrashed && (
                        <DropdownMenuItem onClick={() => onToggleStar(item)} className="gap-2 cursor-pointer">
                          <Star className={cn("w-3.5 h-3.5", item.isStarred && "fill-yellow-500 text-yellow-500")} />
                          <span>{item.isStarred ? "Remove from Starred" : "Add to Starred"}</span>
                        </DropdownMenuItem>
                      )}

                      {!item.isTrashed && onShare && (
                        <DropdownMenuItem onClick={() => onShare(item)} className="gap-2 cursor-pointer">
                          <Share2 className="w-3.5 h-3.5 text-purple-500" />
                          <span>Share</span>
                        </DropdownMenuItem>
                      )}

                      {(() => {
                        const itemCanRename = typeof canRename === "function" ? canRename(item) : !!canRename;
                        const itemCanMove = typeof canMove === "function" ? canMove(item) : !!canMove;
                        const itemCanDelete = typeof canDelete === "function" ? canDelete(item) : !!canDelete;

                        return (
                          <>
                            {!item.isTrashed && (itemCanRename || itemCanMove) && (
                              <>
                                <DropdownMenuSeparator />

                                {itemCanRename && onRename && (
                                  <DropdownMenuItem onClick={() => onRename(item)} className="gap-2 cursor-pointer">
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Rename</span>
                                  </DropdownMenuItem>
                                )}

                                {itemCanMove && onMove && (
                                  <DropdownMenuItem onClick={() => onMove(item)} className="gap-2 cursor-pointer">
                                    <FolderInput className="w-3.5 h-3.5" />
                                    <span>Move</span>
                                  </DropdownMenuItem>
                                )}

                                {/* Folder Color Submenu */}
                                {itemCanRename && isFolder && onChangeColor && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="gap-2">
                                      <Palette className="w-3.5 h-3.5" />
                                      <span>Change Color</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-44 rounded-xl p-1.5">
                                      <div className="grid grid-cols-4 gap-1.5 p-1">
                                        {FOLDER_COLORS.map((c) => (
                                          <button
                                            key={c.name}
                                            onClick={() => onChangeColor(item, c.value)}
                                            className={cn(
                                              "w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer",
                                              c.bg,
                                              item.color === c.value && "ring-2 ring-foreground ring-offset-2"
                                            )}
                                            title={c.name}
                                          >
                                            {item.color === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                                          </button>
                                        ))}
                                      </div>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}
                              </>
                            )}

                            {/* Restore option if item is trashed */}
                            {item.isTrashed && onRestore && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onRestore(item)}
                                  className="gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restore</span>
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Delete / Move to Trash option */}
                            {((item.isTrashed ? canDeletePermanently : itemCanDelete) && onTrash) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onTrash(item)}
                                  className="gap-2 text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{item.isTrashed ? "Delete Permanently" : "Move to Trash"}</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
