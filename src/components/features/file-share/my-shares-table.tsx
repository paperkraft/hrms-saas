"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Download,
  Trash2,
  Link as LinkIcon,
  Users,
  Globe,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  FileImage,
  FileVideo,
  FileAudio,
  File as FileGeneric,
  Folder,
  Eye,
  Building2,
  Clock,
  Loader2,
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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn, formatFileSize } from "@/lib/utils";

interface MySharesTableProps {
  myShares: any[];
  loading: boolean;
  onSuccess: () => void;
}

export function getFileIcon(fileName: string, isFolder?: boolean) {
  if (isFolder) {
    return { icon: Folder, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" };
  }
  const ext = (fileName || "").split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return { icon: FileText, color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" };
    case "xlsx":
    case "xls":
    case "csv":
      return { icon: FileSpreadsheet, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "svg":
    case "gif":
      return { icon: FileImage, color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20" };
    case "mp4":
    case "mkv":
    case "mov":
      return { icon: FileVideo, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" };
    case "mp3":
    case "wav":
      return { icon: FileAudio, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" };
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return { icon: FileArchive, color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20" };
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
    case "json":
    case "html":
    case "css":
      return { icon: FileCode, color: "text-cyan-500", bg: "bg-cyan-500/10 border-cyan-500/20" };
    default:
      return { icon: FileGeneric, color: "text-primary", bg: "bg-primary/10 border-primary/20" };
  }
}

export function MySharesTable({ myShares, loading, onSuccess }: MySharesTableProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/file-share/${deleteConfirmId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("File deleted successfully");
        onSuccess();
      } else {
        toast.error("Failed to delete file");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const copyToClipboard = (id: string) => {
    const url = `${window.location.origin}/api/file-share/${id}/download`;
    navigator.clipboard.writeText(url);
    toast.success("Internal file download link copied");
  };

  const copyPublicLink = (id: string) => {
    const url = `${window.location.origin}/api/p/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Public access link copied to clipboard");
  };

  return (
    <>
      <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="size-7 text-primary animate-spin mb-2.5" />
            <p className="text-xs text-muted-foreground font-medium">Loading your shared files...</p>
          </div>
        ) : myShares.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center px-6 space-y-2.5">
            <div className="size-12 rounded-md bg-muted/60 flex items-center justify-center border border-border/60">
              <FileGeneric className="size-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-bold text-foreground">No shared files found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              You haven't uploaded or shared any files yet. Use the "Share File" button to upload documents.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/70">
                  <TableHead className="text-xs font-bold text-muted-foreground py-3.5 pl-6">
                    File Name
                  </TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                    Size
                  </TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                    Shared With
                  </TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-3.5">
                    Expiration
                  </TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-center">
                    Views
                  </TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-3.5 text-right pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myShares.map((share) => {
                  const { icon: Icon, color, bg } = getFileIcon(share.fileName, share.isFolder);
                  const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();

                  return (
                    <TableRow
                      key={share.id}
                      className="hover:bg-muted/20 border-b border-border/60 transition-colors"
                    >
                      {/* File Name & Icon */}
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
                              Uploaded {format(new Date(share.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Size */}
                      <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                        {share.isFolder ? (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                            Live Folder
                          </span>
                        ) : (
                          formatFileSize(share.size)
                        )}
                      </TableCell>

                      {/* Shared With */}
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                          {share.sharedUsers?.map((u: any) => (
                            <span
                              key={u.id}
                              className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/50 flex items-center gap-1"
                            >
                              <Users className="size-2.5" />
                              <span className="truncate max-w-[100px]">{u.user?.name || "User"}</span>
                            </span>
                          ))}
                          {share.sharedDepartments?.map((d: any) => (
                            <span
                              key={d.id}
                              className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 flex items-center gap-1"
                            >
                              <Building2 className="size-2.5" />
                              <span className="truncate max-w-[100px]">{d.department?.name || "Dept"}</span>
                            </span>
                          ))}
                          {(!share.sharedUsers || share.sharedUsers.length === 0) &&
                            (!share.sharedDepartments || share.sharedDepartments.length === 0) && (
                              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/50 flex items-center gap-1">
                                <LinkIcon className="size-2.5" />
                                <span>Link Only</span>
                              </span>
                            )}
                        </div>
                      </TableCell>

                      {/* Expiration */}
                      <TableCell className="py-3.5">
                        {share.expiresAt ? (
                          isExpired ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
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

                      {/* Views */}
                      <TableCell className="py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
                          <Eye className="size-3" />
                          <span>{share.currentViews || 0}</span>
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3.5 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyPublicLink(share.id)}
                            className="size-8 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                            title="Copy Tiny Public URL"
                          >
                            <Globe className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(share.id)}
                            className="size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                            title="Copy Internal Download Link"
                          >
                            <LinkIcon className="size-3.5" />
                          </Button>

                          {!share.isFolder && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="size-8 rounded-md text-primary hover:bg-primary/10 cursor-pointer"
                              title="Download File"
                            >
                              <a
                                href={`/api/file-share/${share.id}/download?download=1`}
                                rel="noreferrer"
                              >
                                <Download className="size-3.5" />
                              </a>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(share.id)}
                            className="size-8 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            title="Delete Share"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && !isDeleting && setDeleteConfirmId(null)}
      >
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke & Delete Shared File?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shared file? Access links will immediately expire and all recipients will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-md text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md text-xs font-semibold"
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
