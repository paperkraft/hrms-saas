"use client";

import { format } from "date-fns";
import {
  Download,
  File as FileGeneric,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui";
import { cn, formatFileSize, getInitials } from "@/lib/utils";
import { getFileIcon } from "./my-shares-table";

interface SharedWithMeTableProps {
  sharedWithMe: any[];
  loading: boolean;
}

export function SharedWithMeTable({ sharedWithMe, loading }: SharedWithMeTableProps) {
  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Loader2 className="size-7 text-primary animate-spin mb-2.5" />
          <p className="text-xs text-muted-foreground font-medium">Loading incoming shares...</p>
        </div>
      ) : sharedWithMe.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center px-6 space-y-2.5">
          <div className="size-12 rounded-md bg-muted/60 flex items-center justify-center border border-border/60">
            <FileGeneric className="size-6 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No shared files received</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Files and folders shared directly with you or your department will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/70">
                <TableHead className="text-xs font-bold text-muted-foreground py-3.5 pl-6">
                  File / Folder Name
                </TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                  Size
                </TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                  Shared By
                </TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                  Expiration
                </TableHead>
                <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-right pr-6">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sharedWithMe.map((share) => {
                const { icon: Icon, color, bg } = getFileIcon(share.fileName, share.isFolder);
                const uploaderName = share.uploader?.name || "Colleague";
                const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();

                return (
                  <TableRow
                    key={share.id}
                    className="hover:bg-muted/20 border-b border-border/60 transition-colors"
                  >
                    {/* File Name */}
                    <TableCell className="py-3.5 pl-6 font-medium">
                      <div className="flex items-center gap-3 min-w-0 max-w-md">
                        <div className={cn("p-2 rounded-md border shrink-0", bg)}>
                          <Icon className={cn("size-4", color)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-bold text-foreground truncate"
                            title={share.fileName}
                          >
                            {share.fileName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Received {format(new Date(share.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Size */}
                    <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                      {share.isFolder ? (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                          Live Folder
                        </span>
                      ) : (
                        formatFileSize(share.size)
                      )}
                    </TableCell>

                    {/* Shared By */}
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6 border border-border/60">
                          <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                            {getInitials(uploaderName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-foreground truncate">
                          {uploaderName}
                        </span>
                      </div>
                    </TableCell>

                    {/* Expiration */}
                    <TableCell className="py-3.5">
                      {share.expiresAt ? (
                        isExpired ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                            Expired
                          </span>
                        ) : (
                          <span className="text-xs text-foreground/80 flex items-center gap-1">
                            <Clock className="size-3 text-muted-foreground" />
                            <span>{format(new Date(share.expiresAt), "MMM d, yyyy")}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 pr-6 text-right">
                      {!share.isFolder && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 px-3 text-xs font-semibold rounded-md hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer shadow-2xs"
                        >
                          <a
                            href={`/api/file-share/${share.id}/download?download=1`}
                            rel="noreferrer"
                          >
                            <Download className="size-3.5 mr-1.5" />
                            <span>Download</span>
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
