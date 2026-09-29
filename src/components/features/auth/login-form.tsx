"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Lock, Download, Smartphone } from "lucide-react";
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

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
        window.location.href = "/dashboard";
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
            <Input 
              id="password" 
              type="password" 
              {...register("password")} 
              disabled={isLoading}
              className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
            />
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

      <div className="pt-2 text-center">
        <Link 
          href="/super-admin/login" 
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          <span>Platform Super Admin Portal</span>
        </Link>
      </div>

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