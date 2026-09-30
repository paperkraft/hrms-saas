import { ShieldCheck, Users, Building2 } from "lucide-react";
import { LoginForm } from "@/components/features/auth/login-form";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { appConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export default async function TenantLoginPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const session = await getServerSession(authOptions);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug.toLowerCase().trim() },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      logoUrl: true,
      primaryColor: true,
      status: true,
    },
  });

  if (!tenant) {
    redirect(`/login?ws_not_found=${encodeURIComponent(tenantSlug)}`);
  }

  if (session?.user) {
    redirect(`/${tenant.slug}/dashboard`);
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">
      {/* Left Column: Tenant Branding */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-primary/5 p-10 lg:p-16 border-r border-border/50">
        <div className="flex items-center gap-3 text-primary">
          {tenant.logoUrl ? (
            <Image
              src={tenant.logoUrl}
              alt={tenant.name}
              width={180}
              height={60}
              className="h-10 w-auto object-contain"
              priority
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
                style={{ backgroundColor: tenant.primaryColor || "#2563eb" }}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">
                {tenant.name}
              </span>
            </div>
          )}
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-4xl font-bold tracking-tight text-foreground">
            Welcome to <br />
            <span style={{ color: tenant.primaryColor || "inherit" }}>{tenant.name}</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {tenant.tagline ||
              "Sign in to access your attendance, tasks, projects, and organizational workspace."}
          </p>

          <div className="flex gap-3 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium bg-card border border-border px-3 py-1.5 rounded-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Dedicated Workspace
            </div>
            <div className="flex items-center gap-2 text-sm font-medium bg-card border border-border px-3 py-1.5 rounded-sm">
              <Users className="w-4 h-4 text-blue-600" /> Secure Multi-Tenant Access
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {tenant.name}. Powered by {appConfig.appName}.
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <LoginForm tenantSlug={tenant.slug} />
      </div>
    </div>
  );
}
