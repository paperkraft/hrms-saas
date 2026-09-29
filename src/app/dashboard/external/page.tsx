import { PageContainer } from "@/components/ui";
import { getExternalDashboardStats } from "@/actions/dashboard/external";
import { ExternalDashboardClient } from "@/components/features/dashboard/external-dashboard-client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExternalDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const result = await getExternalDashboardStats();
  if (!result.success || !result.data) {
    return (
      <PageContainer maxWidth="full" className="py-8 animate-fade-in">
        <div className="p-8 text-center text-muted-foreground">
          <p>Failed to load external dashboard.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      <ExternalDashboardClient initialData={result.data} />
    </PageContainer>
  );
}
