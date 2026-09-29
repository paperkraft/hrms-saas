import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TenantRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;

  // Validate tenant exists in database
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug.toLowerCase().trim() },
    select: {
      id: true,
      slug: true,
      name: true,
      primaryColor: true,
      status: true,
    },
  });

  if (!tenant) {
    notFound();
  }

  return (
    <div
      className="min-h-screen"
      style={
        tenant.primaryColor
          ? ({ "--tenant-primary": tenant.primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
