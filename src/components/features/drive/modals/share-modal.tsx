"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Users,
  User,
  Building,
  Check,
  Copy,
  Trash2,
  Loader2,
  Folder,
  X,
} from "lucide-react";
import {
  DriveItemWithDetails,
  getShareableEntities,
  getDriveItemPermissions,
  shareDriveItem,
  removeDriveItemPermission,
} from "@/actions/drive";
import { getFileTypeIcon } from "../drive-file-card";
import { cn } from "@/lib/utils";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DriveItemWithDetails | null;
}

export function ShareModal({ isOpen, onClose, item }: ShareModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Entities available to share with
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Existing permissions
  const [owner, setOwner] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(true);

  // New share selection
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState<"VIEWER" | "EDITOR">("VIEWER");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen && item) {
      loadData();
    } else {
      setSelectedUserIds([]);
      setSelectedDeptIds([]);
      setSearchQuery("");
      setCopied(false);
    }
  }, [isOpen, item]);

  const loadData = async () => {
    if (!item) return;
    setLoading(true);
    try {
      const [entitiesRes, permsRes] = await Promise.all([
        getShareableEntities(),
        getDriveItemPermissions(item.id),
      ]);

      if (entitiesRes.success) {
        setUsers(entitiesRes.users || []);
        setDepartments(entitiesRes.departments || []);
      }

      if (permsRes.success) {
        setOwner(permsRes.owner);
        setPermissions(permsRes.permissions || []);
        setIsOwner(permsRes.isOwner ?? true);
      }
    } catch (err) {
      console.error("Error loading share data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    if (!selectedUserIds.includes(userId)) {
      setSelectedUserIds((prev) => [...prev, userId]);
    }
    setSearchQuery(""); // Close dropdown immediately
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleSelectDept = (deptId: string) => {
    if (!selectedDeptIds.includes(deptId)) {
      setSelectedDeptIds((prev) => [...prev, deptId]);
    }
    setSearchQuery(""); // Close dropdown immediately
  };

  const handleRemoveDept = (deptId: string) => {
    setSelectedDeptIds((prev) => prev.filter((id) => id !== deptId));
  };

  const handleShare = async () => {
    if (!item || (selectedUserIds.length === 0 && selectedDeptIds.length === 0)) return;
    setSaving(true);
    try {
      const res = await shareDriveItem(item.id, {
        userIds: selectedUserIds,
        departmentIds: selectedDeptIds,
        accessLevel,
      });

      if (res.success) {
        setSelectedUserIds([]);
        setSelectedDeptIds([]);
        setSearchQuery("");
        await loadData();
      }
    } catch (err) {
      console.error("Error sharing item:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePermission = async (permId: string) => {
    try {
      setPermissions((prev) => prev.filter((p) => p.id !== permId));
      await removeDriveItemPermission(permId);
    } catch (err) {
      console.error("Error removing permission:", err);
      loadData();
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/dashboard/documents?id=${item?.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!item) return null;

  const isFolder = item.type === "FOLDER";
  const typeConfig = isFolder ? null : getFileTypeIcon(item.mimeType, item.extension);
  const Icon = isFolder ? Folder : typeConfig!.icon;

  const filteredUsers = users.filter((u) => {
    if (u.id === item.ownerId) return false;
    if (permissions.some((p) => p.userId === u.id)) return false;
    if (selectedUserIds.includes(u.id)) return false;
    const q = searchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.designation && u.designation.toLowerCase().includes(q))
    );
  });

  const filteredDepts = departments.filter((d) => {
    if (permissions.some((p) => p.departmentId === d.id)) return false;
    if (selectedDeptIds.includes(d.id)) return false;
    return d.name && d.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalSelected = selectedUserIds.length + selectedDeptIds.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-125 p-0 overflow-hidden rounded-2xl bg-card border shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b bg-muted/20 text-left">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs",
                isFolder ? "bg-slate-500/10 text-slate-600" : cn(typeConfig?.bg, typeConfig?.color)
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold text-foreground truncate">
                Share "{item.name}"
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                {isFolder ? "Folder" : item.extension?.toUpperCase() || "File"} • Manage access and permissions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Add People & Groups */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Add people & departments
            </label>

            <div className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary shadow-2xs"
                />
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as any)}
                  className="px-3 py-2.5 text-xs rounded-xl border bg-background text-foreground focus:outline-hidden font-medium cursor-pointer shadow-2xs"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="EDITOR">Editor</option>
                </select>
              </div>

              {/* Search Suggestions Dropdown */}
              {searchQuery.trim().length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border bg-card shadow-xl divide-y divide-border/40 text-xs">
                  {filteredDepts.length > 0 && (
                    <div className="p-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                        Departments
                      </div>
                      {filteredDepts.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleSelectDept(d.id)}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-accent cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="font-medium text-foreground">{d.name}</span>
                            <span className="text-[10px] text-muted-foreground">({d._count?.members || 0} members)</span>
                          </div>
                          <span className="text-[11px] text-primary opacity-0 group-hover:opacity-100 font-medium">Select</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredUsers.length > 0 && (
                    <div className="p-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                        Users
                      </div>
                      {filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectUser(u.id)}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-accent cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                              {u.name ? u.name[0].toUpperCase() : "U"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                          <span className="text-[11px] text-primary opacity-0 group-hover:opacity-100 font-medium">Select</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredUsers.length === 0 && filteredDepts.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground text-xs">
                      No matching users or departments found
                    </div>
                  )}
                </div>
              )}

              {/* Selected Pills */}
              {totalSelected > 0 && (
                <div className="space-y-2.5 p-3 bg-muted/30 rounded-xl border border-border/60 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>Selected ({totalSelected})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserIds([]);
                        setSelectedDeptIds([]);
                      }}
                      className="text-muted-foreground hover:text-rose-500 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedUserIds.map((uid) => {
                      const u = users.find((x) => x.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20 shadow-2xs"
                        >
                          <User className="w-3 h-3" />
                          <span>{u?.name || "User"}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUser(uid)}
                            className="hover:text-rose-500 ml-0.5 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    {selectedDeptIds.map((did) => {
                      const d = departments.find((x) => x.id === did);
                      return (
                        <span
                          key={did}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 text-xs font-medium border border-blue-500/20 shadow-2xs"
                        >
                          <Building className="w-3 h-3" />
                          <span>{d?.name || "Dept"}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDept(did)}
                            className="hover:text-rose-500 ml-0.5 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={handleShare}
                      disabled={saving}
                      className="rounded-xl text-xs font-medium px-4 h-8 gap-1.5 shadow-xs"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                      <span>Share with {totalSelected} Selected</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* People with Access List */}
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Who has access
            </label>

            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Loading permissions...</span>
              </div>
            ) : (
              <div className="space-y-1 divide-y divide-border/40 bg-muted/20 p-3 rounded-xl border border-border/50">
                {/* Owner Row */}
                <div className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {owner?.name ? owner.name[0].toUpperCase() : "O"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {owner?.name || "Owner"} <span className="text-[10px] text-muted-foreground font-normal">(you)</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{owner?.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded bg-muted/60">
                    Owner
                  </span>
                </div>

                {/* Shared Entities */}
                {permissions.map((p) => {
                  const isDept = !!p.departmentId;
                  const title = isDept ? p.department?.name : p.user?.name;
                  const subtitle = isDept ? "Department" : p.user?.email;

                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                            isDept ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                          )}
                        >
                          {isDept ? <Building className="w-3.5 h-3.5" /> : title ? title[0].toUpperCase() : "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {p.accessLevel}
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemovePermission(p.id)}
                            className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                            title="Remove access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {permissions.length === 0 && (
                  <p className="text-[11px] text-muted-foreground py-2 italic text-center">
                    Not shared with anyone else yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Proper Padding */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="rounded-xl text-xs gap-1.5 h-9 px-3.5 shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Link Copied!" : "Copy Link"}</span>
          </Button>

          <Button
            type="button"
            onClick={onClose}
            className="rounded-xl text-xs px-6 h-9 font-medium shadow-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
