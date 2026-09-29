"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, Unlock, ShieldAlert, KeyRound, Loader2, ArrowRight, HelpCircle, ShieldCheck, RefreshCw, Key, Shield } from "lucide-react";
import { verifyPayrollPin, adminResetPayrollPin } from "@/actions/payroll/security";
import { useSession } from "next-auth/react";
import { isAdminRole } from "@/lib/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PayrollPinGateProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

const STORAGE_KEY = "hrms_payroll_vault_unlocked";

export function PayrollPinGate({
  children,
  title = "Confidential Compensation Vault",
  description = "Please enter your 4-digit Security PIN to view salary slips and payroll registers.",
  className,
}: PayrollPinGateProps) {
  const { data: session } = useSession();
  const isAdmin = isAdminRole(session?.user);

  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [pin, setPin] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recovery / Reset Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [resetMode, setResetMode] = useState<"choose" | "custom">("choose");
  const [adminNewPin, setAdminNewPin] = useState<string>("");
  const [adminConfirmPin, setAdminConfirmPin] = useState<string>("");
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>("");

  // Check sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === "true") {
        setIsUnlocked(true);
      }
    } catch {
      // sessionStorage might fail in private browsing mode
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  // Auto focus input when locked
  useEffect(() => {
    if (!isUnlocked && !isCheckingSession && !isForgotModalOpen) {
      inputRef.current?.focus();
    }
  }, [isUnlocked, isCheckingSession, isForgotModalOpen]);

  const handleLock = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { }
    setIsUnlocked(false);
    setPin("");
    setError("");
    toast.info("Payroll vault locked.");
  };

  // Inactivity Auto-Lock Timer (2 Minutes)
  useEffect(() => {
    if (!isUnlocked) return;

    const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch { }
        setIsUnlocked(false);
        setPin("");
        setError("");
        toast.info("Payroll vault auto-locked due to 2 minutes of inactivity.");
      }, INACTIVITY_TIMEOUT);
    };

    // Initial timer start
    resetTimer();

    // Activity event listeners to keep session alive while actively working
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isUnlocked]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim() || isLoading) return;

    if (pin.length !== 4) {
      setError("PIN must be 4 digits.");
      triggerShake();
      return;
    }

    verifyDirect(pin);
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const verifyDirect = async (directPin: string) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await verifyPayrollPin(directPin);
      if (res.success) {
        try {
          sessionStorage.setItem(STORAGE_KEY, "true");
        } catch { }
        setIsUnlocked(true);
        toast.success("Security PIN verified. Vault unlocked.");
      } else {
        setError(res.error || "Incorrect Security PIN.");
        triggerShake();
        setPin("");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify PIN.");
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminResetDefault = async () => {
    setIsResetting(true);
    setResetError("");
    try {
      const res = await adminResetPayrollPin({ resetToDefault: true });
      if (res.success) {
        toast.success("Security PIN restored to system default. Unlocking vault...");
        setIsForgotModalOpen(false);
        // Automatically verify and unlock
        await verifyDirect("1234");
      } else {
        setResetError(res.error || "Failed to reset PIN.");
      }
    } catch (err: any) {
      setResetError(err.message || "Failed to reset PIN.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleAdminCustomReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminNewPin || adminNewPin.length !== 4) {
      setResetError("New PIN must be exactly 4 digits.");
      return;
    }
    if (adminNewPin !== adminConfirmPin) {
      setResetError("PIN confirmation does not match.");
      return;
    }

    setIsResetting(true);
    setResetError("");
    try {
      const res = await adminResetPayrollPin({ newPin: adminNewPin });
      if (res.success) {
        toast.success("Security PIN updated. Unlocking vault...");
        setIsForgotModalOpen(false);
        setAdminNewPin("");
        setAdminConfirmPin("");
        setResetMode("custom");
        // Automatically verify and unlock with new PIN
        await verifyDirect(adminNewPin);
      } else {
        setResetError(res.error || "Failed to update PIN.");
      }
    } catch (err: any) {
      setResetError(err.message || "Failed to update PIN.");
    } finally {
      setIsResetting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] bg-card border border-border/80 rounded-md p-8 shadow-2xs">
        <Loader2 className="size-6 text-primary animate-spin mb-2" />
        <p className="text-xs text-muted-foreground font-medium">Securing compensation records...</p>
      </div>
    );
  }

  // Unlocked State with Lock Toolbar Button
  if (isUnlocked) {
    return (
      <div className={cn("space-y-3 relative", className)}>
        {/* Security Lock Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs shadow-2xs">
          <div className="flex items-center gap-2 font-semibold">
            <Unlock className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Vault Unlocked (Session Active)</span>
          </div>
          <button
            type="button"
            onClick={handleLock}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-background hover:bg-muted text-foreground border border-border/80 font-bold text-[11px] shadow-2xs hover:text-rose-600 transition-colors cursor-pointer"
            title="Lock page immediately"
          >
            <Lock className="size-3 text-rose-500" />
            <span>Lock Now</span>
          </button>
        </div>

        {children}
      </div>
    );
  }

  // Locked PIN Gate UI
  return (
    <>
      <div className={cn("flex items-center justify-center py-12 px-4", className)}>
        <div
          className={cn(
            "w-full max-w-sm bg-card border border-border/90 rounded-md p-6 shadow-md transition-transform duration-200",
            isShaking && "animate-shake border-rose-500/80 ring-2 ring-rose-500/20"
          )}
        >
          {/* Header Icon & Title */}
          <div className="text-center space-y-2 mb-6">
            <div className="size-12 mx-auto rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
              <Lock className="size-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center justify-center gap-1.5">
                <KeyRound className="size-4 text-primary" /> {title}
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Masked PIN Display Dots */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center items-center gap-3 my-3">
              {[0, 1, 2, 3].map((index) => {
                const hasDigit = pin.length > index;
                return (
                  <div
                    key={index}
                    className={cn(
                      "size-3.5 rounded-full border-2 transition-all duration-200",
                      hasDigit
                        ? "bg-primary border-primary scale-110 shadow-xs"
                        : "border-muted-foreground/40 bg-muted/20"
                    )}
                  />
                );
              })}
            </div>

            {/* Direct Input for 4 digits */}
            <div className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPin(val);
                    setError("");
                    if (val.length === 4) {
                      verifyDirect(val);
                    }
                  }}
                  placeholder="••••"
                  className="w-full text-center tracking-[0.5em] text-xl font-mono py-2.5 px-3 rounded-md bg-background border border-input focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  autoFocus
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-1.5 p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold text-center justify-center animate-in fade-in">
                  <ShieldAlert className="size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || pin.length !== 4}
                className="w-full h-9 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-40"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <span>Unlock Records</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>

              {/* Recovery / Forgot PIN Trigger */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetError("");
                    setResetMode("choose");
                    setIsForgotModalOpen(true);
                  }}
                  className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="size-3" />
                  <span>{isAdmin ? "Admin PIN Reset & Recovery" : "Forgot Security PIN?"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Forgot PIN / Admin Reset Modal */}
      <Dialog open={isForgotModalOpen} onOpenChange={setIsForgotModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              {isAdmin ? <Shield className="size-4.5" /> : <Key className="size-4.5" />}
              <DialogTitle>
                {isAdmin ? "Admin Security PIN Recovery" : "Forgot Payroll Security PIN"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5">
              {isAdmin
                ? "As an Administrator, you can set a new Security PIN or restore default system access."
                : "The compensation vault requires a 4-digit security PIN set by your organization."}
            </DialogDescription>
          </DialogHeader>

          {isAdmin ? (
            // ADMIN CONTROLS
            <div className="space-y-4 py-2">
              {resetError && (
                <div className="flex items-center gap-1.5 p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold">
                  <ShieldAlert className="size-3.5 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {/* Set New PIN Form */}
              <form onSubmit={handleAdminCustomReset} className="space-y-3 p-3 rounded-lg border border-border/80 bg-muted/20">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1">
                  <KeyRound className="size-3.5 text-primary" />
                  <span>Set New Security PIN</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      New PIN
                    </label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="4 Digits"
                      value={adminNewPin}
                      onChange={(e) => setAdminNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="h-8.5 text-xs text-center font-mono tracking-widest bg-background"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Confirm PIN
                    </label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="Confirm"
                      value={adminConfirmPin}
                      onChange={(e) => setAdminConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="h-8.5 text-xs text-center font-mono tracking-widest bg-background"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isResetting || adminNewPin.length !== 4 || adminNewPin !== adminConfirmPin}
                  size="sm"
                  className="w-full h-8 text-xs font-bold gap-1.5 cursor-pointer bg-primary text-primary-foreground mt-1"
                >
                  {isResetting ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                  <span>Save New PIN & Unlock</span>
                </Button>
              </form>

              {/* Or Quick Restore Default */}
              <div className="pt-1 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isResetting}
                  onClick={handleAdminResetDefault}
                  className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="size-3" />
                  <span>Restore Initial System PIN</span>
                </Button>
              </div>
            </div>
          ) : (
            // STANDARD ACCOUNTANT INSTRUCTIONS
            <div className="space-y-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <div className="p-3.5 rounded-lg border border-border/80 bg-muted/30 space-y-2.5">
                <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>Contact an Administrator</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If you have forgotten or misplaced your Security PIN, please contact Administrator.
                </p>
                <div className="text-[11px] bg-background/80 p-2.5 rounded border border-border/60 text-muted-foreground space-y-1">
                  <div>• Administrators can reset or update the Security PIN directly in System Configuration.</div>
                  <div>• Once updated, you can immediately access the compensation vault with the new PIN.</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsForgotModalOpen(false)}
              className="text-xs h-8 cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

