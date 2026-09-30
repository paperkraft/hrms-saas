"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, AlertTriangle, Loader2, Lock, Download, Smartphone, Eye, EyeOff } from "lucide-react";
import { signIn, getSession } from "next-auth/react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { appConfig } from "@/lib/app-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LoginFormProps {
  tenantSlug?: string;
  invalidWorkspace?: string;
}

export function LoginForm({ tenantSlug, invalidWorkspace }: LoginFormProps = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { installPrompt, isStandalone, isIOS, handleInstallClick } = usePWAInstall();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginValues) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const signInData: Record<string, any> = {
        email: data.email,
        password: data.password,
        redirect: false,
      };

      if (tenantSlug && tenantSlug !== "undefined" && tenantSlug.trim().length > 0) {
        signInData.tenantSlug = tenantSlug.trim();
      }

      const result = await signIn("credentials", signInData);

      if (result?.error) {
        if (result.error && result.error !== "CredentialsSignin") {
          setAuthError(result.error);
        } else {
          setAuthError("Invalid email or password.");
        }
        setIsLoading(false);
        return;
      }
      
      const session = await getSession();
      if (session?.user?.role === "SUPER_ADMIN" || session?.user?.tenantSlug === "super-admin") {
        window.location.href = "/super-admin";
      } else {
        const slug = session?.user?.tenantSlug || "sigma";
        window.location.href = `/${slug}/dashboard`;
      }
      
    } catch (error) {
      setAuthError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2 text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your workspace.
          </p>
        </div>

        {invalidWorkspace && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs p-3.5 rounded-lg flex items-start gap-2.5 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-left">
              <p className="font-semibold text-xs text-amber-700 dark:text-amber-300">
                Workspace &quot;{invalidWorkspace}&quot; not found
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Please sign in with your work email below. You will be routed to your assigned organization automatically.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@company.com" 
              {...register("email")} 
              disabled={isLoading}
              className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                {...register("password")} 
                disabled={isLoading}
                className={`pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none p-0.5 rounded cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive font-medium">{errors.password.message}</p>
            )}
          </div>
        </div>

        {authError && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {authError}
          </div>
        )}

        <Button type="submit" className="w-full h-11 text-base shadow-lg shadow-primary/20" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" /> Sign In
            </>
          )}
        </Button>
      </form>

      {/* PWA Install Button (if eligible and not already standalone) */}
      {!isStandalone && (installPrompt || isIOS) && (
        <div className="pt-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Mobile Access</span>
            </div>
          </div>
          
          <div className="mt-4">
            {isIOS ? (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all">
                    <Smartphone className="size-4" />
                    Install App (iOS)
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Install {appConfig.appName} on iOS</DialogTitle>
                    <DialogDescription>
                      Follow these steps to add the app to your home screen:
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
                      <p className="text-sm">Open this page in <span className="font-semibold text-foreground">Safari</span> browser.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</div>
                      <p className="text-sm">Tap the <span className="font-semibold text-foreground">Share</span> button at the bottom of the screen.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</div>
                      <p className="text-sm">Scroll down and tap <span className="font-semibold text-foreground">"Add to Home Screen"</span>.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Button 
                variant="outline" 
                onClick={handleInstallClick}
                className="w-full gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
              >
                <Download className="size-4" />
                Install App
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}