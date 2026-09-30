import { ShieldCheck, Users } from "lucide-react";
import { LoginForm } from "@/components/features/auth/login-form";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { appConfig } from "@/lib/app-config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ ws_not_found?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  const invalidWorkspace =
    typeof resolvedParams?.ws_not_found === "string" && resolvedParams.ws_not_found.trim().length > 0
      ? resolvedParams.ws_not_found.trim()
      : undefined;

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background">

      {/* Left Column: Branding (Hidden on small mobile screens) */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-primary/5 p-10 lg:p-16 border-r border-border/50">
        <div className="flex items-center gap-2 text-primary">
          <Image 
            src={appConfig.logoUrl} 
            alt={appConfig.appName} 
            width={180} 
            height={60} 
            className="h-10 w-auto"
            priority
          />
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-4xl font-bold tracking-tight text-foreground">
            Manage your team, <br />
            <span className="text-primary">seamlessly.</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            The all-in-one platform for attendance tracking, leave management, and complex policy compliance. Built for modern enterprises.
          </p>

          <div className="flex gap-3 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium bg-card border border-border px-3 py-1.5 rounded-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure Access
            </div>
            <div className="flex items-center gap-2 text-sm font-medium bg-card border border-border px-3 py-1.5 rounded-sm">
              <Users className="w-4 h-4 text-blue-600" /> Role-Based Routing
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {appConfig.companyName}. All rights reserved.
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        {/* Mobile Logo (Visible only on small screens) */}
        <div className="absolute top-8 left-8 md:hidden flex items-center gap-2 text-primary">
          <Image 
            src={appConfig.logoUrl} 
            alt={appConfig.appName} 
            width={120} 
            height={40} 
            className="h-8 w-auto"
          />
        </div>

        <LoginForm invalidWorkspace={invalidWorkspace} />
      </div>

    </div>
  );
}