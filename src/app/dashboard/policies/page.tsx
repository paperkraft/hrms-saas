"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Loader2,
  Settings2,
  Clock,
  ShieldCheck,
  Calendar,
  Laptop,
  HeartHandshake,
  Printer,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getPolicies } from "@/actions/policy";
import { useSession } from "next-auth/react";
import { PolicyManagementDialog } from "@/components/features/admin/policy-management-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PageContainer } from "@/components/ui";
import { RichTextViewer } from "@/components/ui/rich-text-viewer";
import { isAdminRole } from "@/lib/permissions";
import { appConfig } from "@/lib/app-config";

function getCategoryIcon(category: string) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("attendance") || cat.includes("leave") || cat.includes("time")) {
    return { icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" };
  }
  if (cat.includes("conduct") || cat.includes("ethics") || cat.includes("compliance") || cat.includes("discipline")) {
    return { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
  }
  if (cat.includes("it") || cat.includes("security") || cat.includes("device") || cat.includes("data") || cat.includes("remote")) {
    return { icon: Laptop, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" };
  }
  if (cat.includes("benefit") || cat.includes("compensation") || cat.includes("health") || cat.includes("wellness")) {
    return { icon: HeartHandshake, color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20" };
  }
  return { icon: BookOpen, color: "text-primary", bg: "bg-primary/10 border-primary/20" };
}

function calculateReadingTime(content: string): string {
  const text = (content || "").replace(/<[^>]*>/g, "");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} min read`;
}

export default function PoliciesPage() {
  const { data: session, status } = useSession();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const canManage =
    status === "authenticated" &&
    (session?.user?.role === "ADMIN" ||
      session?.user?.role === "SYSTEM_ADMIN" ||
      session?.user?.role === "ACCOUNTANT" ||
      isAdminRole(session?.user as any));

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await getPolicies();
      if (res.success) {
        setPolicies(res.data || []);
      } else {
        toast.error(res.error || "Failed to load policies");
      }
    } catch (error) {
      toast.error("An error occurred while fetching policies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "loading") {
      fetchPolicies();
    }
  }, [status]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    policies.forEach((p) => {
      if (p.category) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [policies]);

  // Filtered policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const matchesCategory =
        selectedCategory === "ALL" ||
        policy.category?.toLowerCase() === selectedCategory.toLowerCase();

      const search = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !search ||
        policy.title?.toLowerCase().includes(search) ||
        policy.description?.toLowerCase().includes(search) ||
        policy.category?.toLowerCase().includes(search) ||
        policy.content?.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    });
  }, [policies, selectedCategory, searchQuery]);

  // Group filtered policies by category
  const groupedPolicies = useMemo(() => {
    return filteredPolicies.reduce((acc: any, policy: any) => {
      const cat = policy.category || "General Policies";
      if (!acc[cat]) {
        acc[cat] = {
          category: cat,
          items: [],
        };
      }
      acc[cat].items.push(policy);
      return acc;
    }, {});
  }, [filteredPolicies]);

  const handleCopyContent = () => {
    if (!selectedPolicy) return;
    const text = `${selectedPolicy.title}\n\n${selectedPolicy.description || ""}\n\n${(selectedPolicy.content || "").replace(/<[^>]*>/g, "")}`;
    navigator.clipboard.writeText(text);
    toast.success("Policy text copied to clipboard");
  };

  const handlePrint = () => {
    if (!selectedPolicy) return;

    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
      toast.error("Please allow popups to print policies");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${selectedPolicy.title} - Company Policy</title>
          <style>
            @page {
              margin: 18mm 15mm;
              size: A4 portrait;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              line-height: 1.6;
              font-size: 13px;
              margin: 0;
              padding: 0;
            }
            .header {
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 14px;
              margin-bottom: 18px;
            }
            .company {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #6b7280;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .category {
              display: inline-block;
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.05em;
              color: #1d4ed8;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              padding: 2px 8px;
              border-radius: 4px;
              margin-bottom: 8px;
            }
            h1 {
              font-size: 20px;
              font-weight: 800;
              color: #111827;
              margin: 4px 0 8px 0;
              line-height: 1.3;
            }
            .meta {
              font-size: 11px;
              color: #6b7280;
              font-weight: 500;
            }
            .summary-box {
              background: #f8fafc;
              border-left: 3px solid #2563eb;
              padding: 10px 14px;
              margin-bottom: 18px;
              border-radius: 0 4px 4px 0;
              font-size: 12px;
              color: #334155;
            }
            .content {
              font-size: 13px;
              color: #374151;
            }
            .content h1 { font-size: 16px; margin-top: 18px; margin-bottom: 8px; color: #111827; }
            .content h2 { font-size: 14px; margin-top: 14px; margin-bottom: 6px; font-weight: 700; color: #111827; }
            .content h3 { font-size: 13px; margin-top: 12px; margin-bottom: 4px; font-weight: 700; color: #111827; }
            .content p { margin-bottom: 10px; line-height: 1.65; }
            .content ul, .content ol { margin-bottom: 12px; padding-left: 20px; }
            .content li { margin-bottom: 4px; }
            .content strong { color: #111827; font-weight: 600; }
            .content table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
            .content th, .content td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
            .content th { background: #f9fafb; font-weight: 600; }
            .footer {
              margin-top: 30px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">${appConfig.companyFullName} &bull; Official HR Policy</div>
            <div class="category">${selectedPolicy.category || "General Policy"}</div>
            <h1>${selectedPolicy.title}</h1>
            <div class="meta">
              Last revised: ${selectedPolicy.lastUpdated || "Current"} &bull; Status: Active Official Policy
            </div>
          </div>

          ${selectedPolicy.description ? `
            <div class="summary-box">
              <strong>Summary:</strong> ${selectedPolicy.description}
            </div>
          ` : ""}

          <div class="content">
            ${selectedPolicy.content || ""}
          </div>

          <div class="footer">
            <span>Official ${appConfig.appName} Policy Document &bull; Confidential & Internal</span>
            <span>Printed: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 600);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <PageContainer maxWidth="full" className="py-3 sm:py-6 animate-fade-in space-y-3 sm:space-y-4">
      {/* ── 1. EXECUTIVE HEADER BANNER (Desktop Only) ─────────────────────────── */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none mb-1">
              Company Policies & Guidelines
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Official handbook, workplace standards, compliance guidelines, and code of conduct
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage && (
            <PolicyManagementDialog
              onSuccess={fetchPolicies}
              trigger={
                <Button className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs cursor-pointer gap-1.5">
                  <Plus className="size-4" />
                  <span>Create Policy</span>
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* ── 2. SEARCH & FILTER TOOLBAR ─────────────────────────────────── */}
      <div className="rounded-md bg-card border border-border/80 p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Category Filter Pills (Horizontal Scroll) */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border",
                selectedCategory === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
              )}
            >
              All ({policies.length})
            </button>

            {categories.map((cat) => {
              const count = policies.filter((p) => p.category?.toLowerCase() === cat.toLowerCase()).length;
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
                  )}
                >
                  <span>{cat}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                      isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mobile Admin Create Button */}
          {canManage && (
            <div className="md:hidden shrink-0">
              <PolicyManagementDialog
                onSuccess={fetchPolicies}
                trigger={
                  <Button size="sm" className="h-8 px-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs cursor-pointer gap-1">
                    <Plus className="size-3.5" />
                    <span className="hidden xs:inline">Create</span>
                  </Button>
                }
              />
            </div>
          )}
        </div>

        {/* Search Input Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <Input
            placeholder="Search policies by keyword, title, scope..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 pr-4 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
          />
        </div>
      </div>

      {/* ── 3. POLICIES CONTENT GRID ──────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border/80 rounded-md">
          <Loader2 className="size-8 text-primary animate-spin mb-3" />
          <p className="text-xs text-muted-foreground font-medium">Loading organizational policies...</p>
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-md bg-card/60 text-center px-6 space-y-3">
          <div className="p-3.5 rounded-md bg-muted/60 text-muted-foreground border border-border/60">
            <BookOpen className="size-8 opacity-40" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">No matching policies found</h3>
            <p className="text-xs text-muted-foreground">
              {searchQuery
                ? `No policies matched your query "${searchQuery}". Try searching with different keywords.`
                : "No policies have been published in this category yet."}
            </p>
          </div>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("ALL");
              }}
              className="text-xs rounded-md h-8 mt-2 cursor-pointer"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {Object.values(groupedPolicies).map((section: any, idx) => (
            <div key={idx} className="space-y-3">
              {/* Category Header */}
              <div className="flex items-center gap-2 px-1">
                <div className="h-4 w-1 rounded-full bg-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {section.category}
                </h2>
                <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full border border-border/40">
                  {section.items.length} {section.items.length === 1 ? "document" : "documents"}
                </span>
              </div>

              {/* Policy Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                {section.items.map((policy: any, pIdx: number) => {
                  const { icon: CatIcon, color: iconColor, bg: iconBg } = getCategoryIcon(policy.category);
                  const readTime = calculateReadingTime(policy.content);

                  return (
                    <div
                      key={pIdx}
                      className={cn(
                        "group relative p-4 sm:p-5 rounded-md border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.99]"
                      )}
                      onClick={() => setSelectedPolicy(policy)}
                    >
                      <div className="space-y-3">
                        {/* Card Header & Icon */}
                        <div className="flex items-start justify-between gap-3">
                          <div className={cn("p-2 rounded-md border shrink-0", iconBg)}>
                            <CatIcon className={cn("size-4", iconColor)} />
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {canManage && (
                              <PolicyManagementDialog
                                policy={policy}
                                onSuccess={fetchPolicies}
                                trigger={
                                  <button
                                    type="button"
                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                                    title="Edit Policy"
                                  >
                                    <Settings2 className="size-3.5" />
                                  </button>
                                }
                              />
                            )}
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 border border-border/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="size-2.5" />
                              <span>{readTime}</span>
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-sm font-bold text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-2">
                            {policy.title}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">
                            {policy.description}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="pt-3 sm:pt-4 mt-3 border-t border-border/60 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Revised: {policy.lastUpdated}
                        </span>

                        <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                          <span>Read</span>
                          <span>&rarr;</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 4. POLICY DETAILS READER DIALOG ──────────────────────────── */}
      <Dialog
        open={!!selectedPolicy}
        onOpenChange={(open) => !open && setSelectedPolicy(null)}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl p-0 overflow-hidden border-border bg-card rounded-md shadow-xl gap-0 max-h-[88vh] flex flex-col">
          {selectedPolicy && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Dialog Header (With category badge, actions and safe margin for X close button) */}
              <DialogHeader className="p-4 sm:p-6 pr-12 sm:pr-14 border-b border-border/70 bg-muted/20 gap-0 shrink-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    {selectedPolicy.category}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyContent}
                      className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1 rounded-md cursor-pointer"
                      title="Copy Policy Text"
                    >
                      <Copy className="size-3" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrint}
                      className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1 rounded-md cursor-pointer"
                      title="Print Document"
                    >
                      <Printer className="size-3" />
                      <span className="hidden sm:inline">Print</span>
                    </Button>
                  </div>
                </div>

                <DialogTitle className="text-base sm:text-xl font-bold text-foreground tracking-tight leading-snug">
                  {selectedPolicy.title}
                </DialogTitle>

                <DialogDescription className="text-xs text-muted-foreground font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>Last revised: {selectedPolicy.lastUpdated}</span>
                  <span>&bull;</span>
                  <span>{calculateReadingTime(selectedPolicy.content)}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Policy Short Summary Box */}
              {selectedPolicy.description && (
                <div className="px-4 sm:px-6 py-3 bg-primary/5 border-b border-primary/10 shrink-0">
                  <p className="text-xs text-foreground/85 leading-relaxed font-medium">
                    📌 <strong>Summary:</strong> {selectedPolicy.description}
                  </p>
                </div>
              )}

              {/* Dialog Scrollable Rich Text Body */}
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-background/50">
                <RichTextViewer
                  content={selectedPolicy.content}
                  className={cn(
                    "text-xs sm:text-sm leading-relaxed text-foreground",
                    "[&_h1]:text-base sm:[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:text-foreground",
                    "[&_h2]:text-sm sm:[&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2.5 [&_h2]:text-foreground",
                    "[&_h3]:text-xs sm:[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:text-foreground",
                    "[&_p]:mb-3 [&_p]:font-normal [&_p]:leading-relaxed text-muted-foreground",
                    "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mb-4",
                    "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:mb-4",
                    "[&_li]:text-muted-foreground",
                    "[&_strong]:text-foreground [&_strong]:font-semibold"
                  )}
                />
              </div>

              {/* Dialog Footer (Informational metadata only - no redundant close button) */}
              <div className="px-4 sm:px-6 py-2.5 border-t border-border/70 bg-muted/15 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground font-medium">
                  <ShieldCheck className="size-3.5 text-primary shrink-0" />
                  <span>Official {appConfig.appName} Policy Document</span>
                </div>
                <span className="text-[10px] text-muted-foreground/70 font-mono">
                  Active
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
