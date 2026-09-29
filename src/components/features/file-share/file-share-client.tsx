"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileShareUploadDialog } from "./file-share-upload-dialog";
import { MySharesTable } from "./my-shares-table";
import { SharedWithMeTable } from "./shared-with-me-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileShareClient() {
  const [activeTab, setActiveTab] = useState("my-shares");
  const [myShares, setMyShares] = useState<any[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/file-share");
      if (res.ok) {
        const data = await res.json();
        setMyShares(data.myShares || []);
        setSharedWithMe(data.sharedWithMe || []);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load file shares");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users/active");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments");
      if (res.ok) {
        setDepartments(await res.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Filtered shares by search query
  const filteredMyShares = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return myShares;
    return myShares.filter(
      (s) =>
        s.fileName?.toLowerCase().includes(q) ||
        s.sharedWith?.some((u: any) => u.name?.toLowerCase().includes(q)) ||
        s.sharedWithDepts?.some((d: any) => d.name?.toLowerCase().includes(q))
    );
  }, [myShares, search]);

  const filteredSharedWithMe = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sharedWithMe;
    return sharedWithMe.filter(
      (s) =>
        s.fileName?.toLowerCase().includes(q) ||
        s.uploader?.name?.toLowerCase().includes(q)
    );
  }, [sharedWithMe, search]);

  return (
    <div className="space-y-4">
      {/* ── TOOLBAR & CONTROLS ───────────────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-md p-4 lg:p-5 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs Selector */}
          <div className="flex bg-muted/40 p-1 rounded-md border border-border/70 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("my-shares")}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex-1 sm:flex-none cursor-pointer flex items-center justify-center gap-1.5",
                activeTab === "my-shares"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>My Shares</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-muted text-muted-foreground font-semibold">
                {myShares.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("shared-with-me")}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex-1 sm:flex-none cursor-pointer flex items-center justify-center gap-1.5",
                activeTab === "shared-with-me"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Shared With Me</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-muted text-muted-foreground font-semibold">
                {sharedWithMe.length}
              </span>
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  setLoading(true);
                  const { syncFileShareStorage } = await import("@/actions/file-share");
                  const res = await syncFileShareStorage();
                  if (res.error) toast.error(res.error);
                  else {
                    toast.success(res.message);
                    fetchData();
                  }
                } catch (error) {
                  toast.error("Failed to sync storage");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="h-9 px-3 text-xs font-semibold rounded-md border-border/80 hover:bg-primary/5 hover:text-primary gap-1.5 cursor-pointer"
            >
              <Database className={cn("size-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Sync Storage</span>
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              title="Refresh Files"
              disabled={loading}
              className="size-9 rounded-md border-border/80 hover:bg-muted cursor-pointer"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>

            <FileShareUploadDialog
              users={users}
              departments={departments}
              onSuccess={fetchData}
            />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <Input
            placeholder={
              activeTab === "my-shares"
                ? "Search shared files by name, recipient user, or department..."
                : "Search files shared with you by name, uploader..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9.5 pl-9.5 pr-4 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── CONTENT VIEW ─────────────────────────────────────────────── */}
      {activeTab === "my-shares" ? (
        <MySharesTable
          myShares={filteredMyShares}
          loading={loading}
          onSuccess={fetchData}
        />
      ) : (
        <SharedWithMeTable
          sharedWithMe={filteredSharedWithMe}
          loading={loading}
        />
      )}
    </div>
  );
}
