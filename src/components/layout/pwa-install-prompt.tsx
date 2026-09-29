"use client";

import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { appConfig } from "@/lib/app-config";

export function PWAInstallPrompt() {
  const { installPrompt, isStandalone, isIOS, handleInstallClick } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    const isDismissed = sessionStorage.getItem("pwa-prompt-dismissed");
    if (!isDismissed && (installPrompt || isIOS)) {
      setIsVisible(true);
    }
  }, [installPrompt, isStandalone, isIOS]);

  const onInstall = async () => {
    await handleInstallClick();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100 w-[calc(100%-2rem)] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-0.5 bg-linear-to-r from-primary/50 via-primary/30 to-primary/50 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>

        <div className="relative flex items-center justify-between gap-4 p-4 bg-card/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-4 flex-1">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden p-2">
              <Image 
                src="/app-logo.svg" 
                alt="Logo" 
                width={32} 
                height={32} 
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Install App</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {isIOS 
                  ? "Tap Share then 'Add to Home Screen'" 
                  : `Add ${appConfig.appName} to your home screen.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isIOS ? (
              <Button
                size="sm"
                onClick={onInstall}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg px-4 shadow-lg shadow-primary/20 transition-all active:scale-95"
              >
                Install
              </Button>
            ) : (
              <div className="flex items-center justify-center size-9 bg-primary/10 rounded-lg text-primary animate-pulse">
                <Share className="size-4" />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="w-8 h-8 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
