"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  UserPlus,
  Trash2,
  Loader2,
  Users,
  Globe,
  Building,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProjectShares,
  getShareableUsers,
  shareProjectWithUsers,
  revokeProjectShare,
} from "@/actions/projects/sharing";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ProjectShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    name: string;
    client?: string | null;
  } | null;
}

export function ProjectShareModal({
  isOpen,
  onClose,
  project,
}: ProjectShareModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  const [shares, setShares] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState<"ALL" | "EXTERNAL" | "INTERNAL">("EXTERNAL");

  useEffect(() => {
    if (isOpen && project?.id) {
      loadData();
    } else {
      setSelectedUserIds([]);
      setSearchQuery("");
    }
  }, [isOpen, project?.id]);

  async function loadData() {
    if (!project?.id) return;
    setLoading(true);
    try {
      const [sharesRes, usersRes] = await Promise.all([
        getProjectShares(project.id),
        getShareableUsers(project.id),
      ]);

      if (sharesRes.success && sharesRes.data) {
        setShares(sharesRes.data);
      }
      if (usersRes.success && usersRes.data) {
        setAvailableUsers(usersRes.data);
      }
    } catch (error) {
      toast.error("Failed to load project sharing information");
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return availableUsers.filter((u) => {
      // Don't show already shared users in the add section
      if (u.isShared) return false;

      // Filter by type
      if (userFilter === "EXTERNAL" && !u.isExternalComputed) return false;
      if (userFilter === "INTERNAL" && u.isExternalComputed) return false;

      // Filter by search query
      if (query) {
        const nameMatch = u.name?.toLowerCase().includes(query);
        const emailMatch = u.email?.toLowerCase().includes(query);
        const deptMatch = u.department?.name?.toLowerCase().includes(query);
        return nameMatch || emailMatch || deptMatch;
      }

      return true;
    });
  }, [availableUsers, searchQuery, userFilter]);

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  async function handleShare() {
    if (!project?.id || selectedUserIds.length === 0) return;
    setSubmitting(true);
    try {
      const result = await shareProjectWithUsers(project.id, selectedUserIds);
      if (result.success) {
        toast.success(
          `Project shared with ${selectedUserIds.length} collaborator(s) successfully`
        );
        setSelectedUserIds([]);
        await loadData();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to share project");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(userId: string) {
    if (!project?.id) return;
    setRevokingUserId(userId);
    try {
      const result = await revokeProjectShare(project.id, userId);
      if (result.success) {
        toast.success("Access revoked successfully");
        await loadData();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to revoke access");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setRevokingUserId(null);
    }
  }

  const externalCount = availableUsers.filter((u) => u.isExternalComputed).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b bg-muted/20">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Share Project Access
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                  Grant external collaborators and users access to{" "}
                  <span className="font-semibold text-foreground">
                    &quot;{project?.name}&quot;
                  </span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading collaborators...
              </p>
            </div>
          ) : (
            <>
              {/* Active Shares Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Current Collaborators ({shares.length})
                  </h4>
                </div>

                {shares.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-center bg-muted/10">
                    <p className="text-sm text-muted-foreground">
                      No external users or custom collaborators currently have access to this project.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {shares.map((share) => {
                      const u = share.user;
                      const isExt = u?.isExternal || u?.roleDefinition?.isExternal;
                      return (
                        <div
                          key={share.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarImage src={u?.avatarUrl || ""} />
                              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                {u?.name?.slice(0, 2).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate text-foreground">
                                  {u?.name || "Unnamed User"}
                                </span>
                                {isExt ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                  >
                                    <Globe className="w-2.5 h-2.5 mr-1" />
                                    External
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground"
                                  >
                                    Internal
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {u?.email}
                                {u?.department?.name && ` • ${u.department.name}`}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revokingUserId === u?.id}
                            onClick={() => handleRevoke(u?.id)}
                            className="h-8 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                            title="Revoke project access"
                          >
                            {revokingUserId === u?.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-1" />
                                <span className="text-xs">Revoke</span>
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Collaborator Section */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Add People
                  </h4>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setUserFilter("EXTERNAL")}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-medium transition-all",
                        userFilter === "EXTERNAL"
                          ? "bg-background shadow text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      External Users ({externalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserFilter("ALL")}
                      className={cn(
                        "px-2.5 py-1 rounded-md font-medium transition-all",
                        userFilter === "ALL"
                          ? "bg-background shadow text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      All Users
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                {/* User selection list */}
                <div className="border rounded-xl divide-y max-h-56 overflow-y-auto bg-card">
                  {filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {searchQuery
                        ? "No users matching your search."
                        : userFilter === "EXTERNAL"
                        ? "No unshared external users found."
                        : "All users already have access or no users found."}
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleSelectUser(u.id)}
                          className={cn(
                            "flex items-center justify-between p-3 cursor-pointer transition-colors hover:bg-muted/40",
                            isSelected && "bg-primary/5 dark:bg-primary/10"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by div click
                              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                            />
                            <Avatar className="h-8 w-8 border border-border">
                              <AvatarImage src={u.avatarUrl || ""} />
                              <AvatarFallback className="text-xs font-semibold bg-muted">
                                {u.name?.slice(0, 2).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium truncate text-foreground">
                                  {u.name || "Unnamed User"}
                                </span>
                                {u.isExternalComputed && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                  >
                                    External
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {u.email}
                                {u.department?.name && ` • ${u.department.name}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {selectedUserIds.length > 0 ? (
              <span className="font-medium text-foreground">
                {selectedUserIds.length} user(s) selected
              </span>
            ) : (
              <span>Select users above to share project</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Close
            </Button>
            <Button
              size="sm"
              disabled={selectedUserIds.length === 0 || submitting}
              onClick={handleShare}
              className="gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sharing...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Share ({selectedUserIds.length})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
