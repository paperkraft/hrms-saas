"use client";

import { useEffect, useState } from "react";

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Detect standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    // Show the install prompt
    installPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
    
    return outcome;
  };

  return {
    installPrompt,
    isStandalone,
    isIOS,
    handleInstallClick,
  };
}
