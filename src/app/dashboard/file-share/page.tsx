import { Metadata } from "next";
import { FileShareClient } from "@/components/features/file-share/file-share-client";
import { PageContainer } from "@/components/ui";
import { Share2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Internal File Share | HRMS",
  description: "Securely share files internally with colleagues.",
};

export const dynamic = 'force-dynamic';

export default function FileSharePage() {
  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* Page Header Banner (Desktop Only) */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Share2 className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none mb-1">
              Internal File Share
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Securely exchange documents, project packages, and live folders with peers and departments
            </p>
          </div>
        </div>
      </div>

      <FileShareClient />
    </PageContainer>
  );
}
