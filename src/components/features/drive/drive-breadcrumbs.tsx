"use client";

import React from "react";
import { ChevronRight, Home, Folder, Trash2, RotateCcw } from "lucide-react";
import { BreadcrumbItem } from "@/actions/drive";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DriveScopeType } from "./drive-sidebar";

interface DriveBreadcrumbsProps {
  currentScope: DriveScopeType;
  breadcrumbs: BreadcrumbItem[];
  onNavigateFolder: (folderId: string | null, targetScope?: DriveScopeType) => void;
  onDropOnBreadcrumb?: (targetFolderId: string | null) => void;
  isTrash?: boolean;
  onEmptyTrash?: () => void;
  trashedCount?: number;
  canMove?: boolean;
}

export function DriveBreadcrumbs({
  currentScope,
  breadcrumbs,
  onNavigateFolder,
  onDropOnBreadcrumb,
  isTrash,
  onEmptyTrash,
  trashedCount = 0,
  canMove = true,
}: DriveBreadcrumbsProps) {
  const effectiveScope: DriveScopeType =
    currentScope === "TRASH"
      ? "TRASH"
      : breadcrumbs.length > 0 && breadcrumbs[0]?.scope
      ? (breadcrumbs[0].scope as DriveScopeType)
      : currentScope;

  const getScopeTitle = (scope: DriveScopeType) => {
    switch (scope) {
      case "ORGANIZATION_LIBRARY":
        return "Company Library";
      case "PROJECT":
        return "Project Documents";
      case "PERSONAL":
        return "My Drive";
      case "SHARED_WITH_ME":
        return "Shared with me";
      case "STARRED":
        return "Starred";
      case "RECENT":
        return "Recent Files";
      case "TRASH":
        return "Trash";
      default:
        return "Drive";
    }
  };

  return (
    <nav className="h-10 sm:h-12 px-3 sm:px-6 border-b flex items-center justify-between gap-2 bg-background/50 text-sm overflow-x-auto scrollbar-none shrink-0 select-none">
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Scope Root */}
        <button
          onClick={() => onNavigateFolder(null, effectiveScope)}
          onDragOver={(e) => {
            if (!canMove) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            if (!canMove) return;
            e.preventDefault();
            onDropOnBreadcrumb?.(null);
          }}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-foreground/80 hover:text-foreground hover:bg-accent transition-colors font-medium text-xs cursor-pointer",
            breadcrumbs.length === 0 && "text-primary font-semibold bg-primary/5"
          )}
        >
          {effectiveScope === "TRASH" ? (
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          ) : (
            <Home className="w-3.5 h-3.5 text-primary" />
          )}
          <span className="truncate">{getScopeTitle(effectiveScope)}</span>
        </button>

        {/* Dynamic Nested Breadcrumbs */}
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          const crumbScope = (crumb.scope || effectiveScope) as DriveScopeType;

          return (
            <React.Fragment key={crumb.id || idx}>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <button
                onClick={() => onNavigateFolder(crumb.id, crumbScope)}
                onDragOver={(e) => {
                  if (!canMove) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  if (!canMove) return;
                  e.preventDefault();
                  onDropOnBreadcrumb?.(crumb.id);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium max-w-40 truncate transition-colors cursor-pointer",
                  isLast
                    ? "text-foreground font-semibold bg-accent/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                title={crumb.name}
              >
                <Folder className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                <span className="truncate">{crumb.name}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Trash Actions */}
      {isTrash && trashedCount > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onEmptyTrash}
            className="h-8 rounded-full px-3 text-xs gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Empty Trash</span>
          </Button>
        </div>
      )}
    </nav>
  );
}
