import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TenantIndexPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/${tenantSlug}/login`);
  }

  redirect(`/${tenantSlug}/dashboard`);
}
