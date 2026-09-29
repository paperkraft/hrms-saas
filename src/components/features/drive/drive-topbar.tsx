"use client";

import React from "react";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  RefreshCw,
  Info,
  X,
  ArrowUpDown,
  Filter,
  Menu,
  ChevronDown,
  CloudDownload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DriveTopbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  sortBy: "name" | "updatedAt" | "size" | "type";
  sortOrder: "asc" | "desc";
  onSortChange: (sortBy: "name" | "updatedAt" | "size" | "type", sortOrder: "asc" | "desc") => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSyncStorage?: () => void;
  isSyncingStorage?: boolean;
  isSyncDisabled?: boolean;
  onToggleDetails: () => void;
  isDetailsOpen: boolean;
  onToggleMobileSidebar?: () => void;
}

export function DriveTopbar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  isRefreshing,
  onSyncStorage,
  isSyncingStorage = false,
  isSyncDisabled = false,
  onToggleDetails,
  isDetailsOpen,
  onToggleMobileSidebar,
}: DriveTopbarProps) {
  const typeFilterOptions = [
    { id: "all", label: "All items", shortLabel: "All" },
    { id: "folder", label: "Folders", shortLabel: "Folders" },
    { id: "pdf", label: "PDF Documents", shortLabel: "PDF" },
    { id: "spreadsheet", label: "Spreadsheets (Excel, CSV)", shortLabel: "Sheets" },
    { id: "doc", label: "Word & Text Documents", shortLabel: "Docs" },
    { id: "image", label: "Images & Photos", shortLabel: "Images" },
    { id: "presentation", label: "Presentations (PowerPoint)", shortLabel: "Slides" },
    { id: "archive", label: "ZIP & Archives", shortLabel: "ZIP" },
    { id: "media", label: "Audio & Video", shortLabel: "Media" },
  ];

  const getSortLabel = () => {
    switch (sortBy) {
      case "name":
        return sortOrder === "asc" ? "Name (A-Z)" : "Name (Z-A)";
      case "updatedAt":
        return sortOrder === "desc" ? "Newest" : "Oldest";
      case "size":
        return sortOrder === "desc" ? "Largest" : "Smallest";
      case "type":
        return "Type";
      default:
        return "Sort";
    }
  };

  const activeTypeOption = typeFilterOptions.find((t) => t.id === typeFilter);

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm shrink-0 flex flex-col md:flex-row md:items-center md:justify-between md:h-14 px-3 sm:px-4 md:px-6 py-2.5 md:py-0 gap-2 md:gap-3 select-none transition-all">
      {/* ── Row 1 on Mobile, Left Area on Desktop: Search & Type Filter ── */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full md:flex-1 md:max-w-xl lg:max-w-2xl min-w-0">
        {/* Mobile Menu Button (Opens Scopes & Folders Navigation) */}
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileSidebar}
            className="md:hidden rounded-md size-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Open Drive Navigation"
          >
            <Menu className="size-5" />
          </Button>
        )}

        {/* Search Input Container */}
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Drive files & folders..."
            className="pl-9 pr-8 h-9 rounded-md bg-muted/40 border-muted-foreground/20 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary transition-all text-xs sm:text-sm w-full"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter Button & Quick Reset */}
        {typeFilter !== "all" ? (
          <div className="flex items-center h-9 rounded-md bg-primary/10 border border-primary/30 text-primary shrink-0 overflow-hidden shadow-2xs">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-full text-xs font-semibold hover:bg-primary/15 transition-colors cursor-pointer outline-none select-none"
                  title="Change file type filter"
                >
                  <Filter className="size-3.5 shrink-0" />
                  <span className="capitalize truncate max-w-16 sm:max-w-24 md:max-w-28">
                    {activeTypeOption?.shortLabel || "Type"}
                  </span>
                  <ChevronDown className="size-3 opacity-60 shrink-0 hidden sm:inline" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg p-1">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0 text-xs text-muted-foreground font-medium">
                    Filter by File Type
                  </DropdownMenuLabel>
                  <button
                    type="button"
                    onClick={() => onTypeFilterChange("all")}
                    className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <DropdownMenuSeparator />
                {typeFilterOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => onTypeFilterChange(opt.id)}
                    className={cn(
                      "cursor-pointer text-xs flex items-center justify-between rounded-md px-2 py-1.5",
                      typeFilter === opt.id && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    <span>{opt.label}</span>
                    {typeFilter === opt.id && <span className="text-primary font-bold">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Independent 1-Click Clear Button */}
            <button
              type="button"
              onClick={() => onTypeFilterChange("all")}
              className="px-1.5 sm:px-2 h-full hover:bg-primary/20 text-primary border-l border-primary/30 transition-colors flex items-center justify-center cursor-pointer"
              title="Reset filter"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-md px-2.5 sm:px-3.5 gap-1.5 text-xs font-medium border-muted-foreground/20 shrink-0 cursor-pointer"
                title="Filter by file type"
              >
                <Filter className="size-3.5 shrink-0" />
                <span className="hidden sm:inline capitalize">Type</span>
                <ChevronDown className="size-3 text-muted-foreground opacity-60 hidden sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg p-1">
              <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">
                Filter by File Type
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {typeFilterOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.id}
                  onClick={() => onTypeFilterChange(opt.id)}
                  className={cn(
                    "cursor-pointer text-xs flex items-center justify-between rounded-md px-2 py-1.5",
                    typeFilter === opt.id && "bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <span>{opt.label}</span>
                  {typeFilter === opt.id && <span className="text-primary font-bold">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Row 2 on Mobile, Right Area on Desktop: Sort, View Mode & Action Toolbar ── */}
      <div className="flex items-center justify-between md:justify-end gap-1.5 md:gap-2 w-full md:w-auto shrink-0 pt-1.5 md:pt-0 border-t md:border-t-0 border-border/50 md:border-transparent">
        {/* Left Sub-Group on Mobile: Sort Dropdown & View Mode */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 md:h-9 rounded-md px-2 sm:px-2.5 gap-1.5 text-xs font-medium border-muted-foreground/20 cursor-pointer"
                title="Sort items"
              >
                <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] sm:text-xs text-foreground/90 font-medium truncate max-w-24 sm:max-w-none">
                  {getSortLabel()}
                </span>
                <ChevronDown className="size-3 text-muted-foreground opacity-60 hidden sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 rounded-lg shadow-lg p-1">
              <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1">Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onSortChange("name", sortOrder === "asc" ? "desc" : "asc")}
                className="cursor-pointer text-xs flex justify-between rounded-md px-2 py-1.5"
              >
                <span>Name</span>
                {sortBy === "name" && (
                  <span className="text-primary text-[11px] font-medium">
                    {sortOrder === "asc" ? "A-Z" : "Z-A"}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSortChange("updatedAt", sortOrder === "desc" ? "asc" : "desc")}
                className="cursor-pointer text-xs flex justify-between rounded-md px-2 py-1.5"
              >
                <span>Last Modified</span>
                {sortBy === "updatedAt" && (
                  <span className="text-primary text-[11px] font-medium">
                    {sortOrder === "desc" ? "Newest" : "Oldest"}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSortChange("size", sortOrder === "desc" ? "asc" : "desc")}
                className="cursor-pointer text-xs flex justify-between rounded-md px-2 py-1.5"
              >
                <span>File Size</span>
                {sortBy === "size" && (
                  <span className="text-primary text-[11px] font-medium">
                    {sortOrder === "desc" ? "Largest" : "Smallest"}
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-md border border-muted-foreground/20 h-8 md:h-9">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "rounded-md size-7 md:size-8 transition-all cursor-pointer",
                viewMode === "grid" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
              )}
              title="Grid View"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "rounded-md size-7 md:size-8 transition-all cursor-pointer",
                viewMode === "list" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
              )}
              title="List View"
            >
              <ListIcon className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Right Sub-Group: Storage Sync, Refresh, and Details Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* MinIO / FTP Storage Sync Button */}
          {onSyncStorage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onSyncStorage}
                disabled={isSyncDisabled || isSyncingStorage || isRefreshing}
                className={cn(
                  "hidden sm:flex items-center gap-1.5 h-8 md:h-9 px-2.5 rounded-md text-xs font-medium border-muted-foreground/20 transition-all shadow-2xs",
                  isSyncDisabled
                    ? "opacity-50 cursor-not-allowed text-muted-foreground"
                    : "hover:border-primary hover:text-primary cursor-pointer"
                )}
                title={
                  isSyncDisabled
                    ? "Storage sync is not applicable in this section"
                    : "Scan & Sync MinIO Storage (import files uploaded via FTP)"
                }
              >
                <CloudDownload className={cn("size-3.5", isSyncingStorage && "animate-bounce text-primary")} />
                <span>{isSyncingStorage ? "Syncing..." : "Sync Storage"}</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onSyncStorage}
                disabled={isSyncDisabled || isSyncingStorage || isRefreshing}
                className={cn(
                  "sm:hidden flex items-center justify-center rounded-md size-8 text-muted-foreground transition-colors",
                  isSyncDisabled ? "opacity-50 cursor-not-allowed" : "hover:text-foreground cursor-pointer"
                )}
                title={
                  isSyncDisabled
                    ? "Storage sync is not applicable in this section"
                    : "Scan & Sync MinIO Storage (FTP)"
                }
              >
                <CloudDownload className={cn("size-4", isSyncingStorage && "animate-bounce text-primary")} />
              </Button>
            </>
          )}

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing || isSyncingStorage}
            className="flex items-center justify-center rounded-md size-8 md:size-9 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={cn("size-3.5 md:size-4", isRefreshing && "animate-spin text-primary")} />
          </Button>

          {/* Details / Preview Drawer Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDetails}
            className={cn(
              "rounded-md size-8 md:size-9 transition-colors cursor-pointer",
              isDetailsOpen ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
            )}
            title="View Details"
          >
            <Info className="size-3.5 md:size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
