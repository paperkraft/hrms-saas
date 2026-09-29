"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error(error);
  }, [error]);

  const isDeploymentError = error.message.includes("Failed to find Server Action");

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-105 flex-col items-center text-center space-y-6 bg-card p-8 rounded-xl shadow-sm border border-border/50">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <AlertTriangle className="h-10 w-10 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {isDeploymentError ? "Update Available" : "Something went wrong!"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isDeploymentError 
              ? "The application was just updated with new features. Please refresh the page to continue using the latest version."
              : "An unexpected error occurred while processing your request."}
          </p>
        </div>

        <Button 
          onClick={() => {
            if (isDeploymentError) {
              window.location.reload();
            } else {
              reset();
            }
          }} 
          className="w-full flex items-center gap-2"
          size="lg"
        >
          <RefreshCcw className="h-4 w-4" />
          {isDeploymentError ? "Refresh Page" : "Try again"}
        </Button>
      </div>
    </div>
  );
}
