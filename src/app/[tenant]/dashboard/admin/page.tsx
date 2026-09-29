import { PageContainer } from "@/components/ui";
import { getAdminDashboardStats } from "@/actions/dashboard/admin";
import { getAdminReportsData } from "@/actions/dashboard/reports";
import { AdminDashboardClient } from "@/components/features/dashboard/admin-dashboard-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasMenuAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Overview | Administration",
  description: "Real-time workforce attendance, departmental presence, and operational overview.",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/admin")) {
    redirect("/dashboard/employee");
  }

  const resolvedParams = await searchParams;
  const isReportsTab = resolvedParams?.tab === "reports";

  const statsResult = await getAdminDashboardStats();
  const reportsResult = isReportsTab ? await getAdminReportsData() : null;

  if (!statsResult.success || !statsResult.data) {
    return (
      <PageContainer maxWidth="full" className="py-6">
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-sm font-semibold text-destructive">
          Failed to load System Overview data. Please refresh or try again later.
        </div>
      </PageContainer>
    );
  }

  const stats = statsResult.data;
  const reports = reportsResult?.success ? reportsResult.data : null;

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      {/* Real-Time Admin Dashboard Interface */}
      <AdminDashboardClient 
        initialStats={stats} 
        initialReports={reports} 
        userName={session.user.name || "Admin"}
      />
    </PageContainer>
  );
}
