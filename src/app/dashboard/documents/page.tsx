import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DriveClient } from "@/components/features/drive/drive-client";
import { redirect } from "next/navigation";
import { DriveScopeType } from "@/components/features/drive/drive-sidebar";
import { PageContainer } from "@/components/ui";
import { Library } from "lucide-react";
import { isExternalUser } from "@/lib/permissions";

export const metadata = {
  title: "Drive & Documents",
  description: "Company document library and project drive",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; scope?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const isExternal = isExternalUser(session.user);
  const resolvedSearchParams = await searchParams;
  let initialScope: DriveScopeType = "ORGANIZATION_LIBRARY";

  const tabOrScope = (resolvedSearchParams.scope || resolvedSearchParams.tab || "").toLowerCase();

  if (tabOrScope === "project" || tabOrScope === "projects") {
    initialScope = isExternal ? "ORGANIZATION_LIBRARY" : "PROJECT";
  } else if (tabOrScope === "personal" || tabOrScope === "my-drive") {
    initialScope = "PERSONAL";
  } else if (tabOrScope === "shared" || tabOrScope === "shared-with-me") {
    initialScope = "SHARED_WITH_ME";
  } else if (tabOrScope === "starred") {
    initialScope = "STARRED";
  } else if (tabOrScope === "recent") {
    initialScope = "RECENT";
  } else if (tabOrScope === "trash") {
    initialScope = "TRASH";
  }

  return (
    <PageContainer
      maxWidth="full"
      className="h-[calc(100dvh-64px)] max-h-[calc(100dvh-64px)] py-2 sm:py-3 px-2 sm:px-4 md:px-6 flex flex-col min-h-0 overflow-hidden space-y-2 sm:space-y-4"
    >
      {/* ── Executive Header Banner (Desktop Only) ── */}
      <div className="hidden md:flex rounded-md bg-card border border-border/80 p-5 shadow-2xs flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Library className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight leading-none mb-1">
              Documents & Drive
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Centralized organizational library, templates, project files, and cloud document storage
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full border border-border/80 rounded-md overflow-hidden bg-card shadow-2xs">
        <DriveClient
          initialScope={initialScope}
          userRole={session.user.role}
          isTeamLeader={session.user.isTeamLeader}
          isExternal={isExternal}
          currentUserId={session.user.id}
        />
      </div>
    </PageContainer>
  );
}
