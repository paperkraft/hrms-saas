import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardRootPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${tenantSlug}/login`);
  }

  const role = session.user.role;
  const isExternal = session.user.isExternal;

  if (role === "SUPER_ADMIN") {
    redirect("/super-admin");
  }

  if (role === "ADMIN") {
    redirect(`/${tenantSlug}/dashboard/admin`);
  }

  if (role === "ACCOUNTANT") {
    redirect(`/${tenantSlug}/dashboard/accountant`);
  }

  if (isExternal || role === "EXTERNAL_USER") {
    redirect(`/${tenantSlug}/dashboard/external`);
  }

  redirect(`/${tenantSlug}/dashboard/employee`);
}
