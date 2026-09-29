"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function VersionNotifier() {
  const currentVersion = useRef<string | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const timestamp = new Date().getTime();
        // Prevent caching with a unique timestamp query param
        const response = await fetch(`/version.json?t=${timestamp}`, {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data.version;

        if (!currentVersion.current) {
          // Initial load
          currentVersion.current = serverVersion;
          return;
        }

        if (serverVersion && serverVersion !== currentVersion.current) {
          // Version changed!
          toast("A new version of the app is available.", {
            action: {
              label: "Update",
              onClick: () => window.location.reload(),
            },
            duration: Infinity, // Keep open until clicked or dismissed
            id: "version-update-toast", // Prevent duplicates
          });
        }
      } catch (error) {
        // Silently ignore fetch errors (e.g. if offline)
      }
    };

    // Check immediately on mount, then poll
    checkVersion();
    const intervalId = setInterval(checkVersion, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  // Catch ChunkLoadError globally to force a reload seamlessly if navigating
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.name === "ChunkLoadError" ||
        event.reason?.message?.includes("Loading chunk")
      ) {
        // Prevent default error handling (crashing the UI)
        event.preventDefault();

        // Force reload the page so the browser gets the new chunks
        window.location.reload();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
