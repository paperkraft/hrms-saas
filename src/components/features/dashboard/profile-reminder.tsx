"use client";

import { useState, useEffect } from "react";
import { User, AlertCircle, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileDialog } from "@/components/features/profile/profile-dialog";
import { getUserProfile } from "@/actions/user";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProfileReminderProps {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  missingFields?: string[];
}

export function ProfileReminder({ user, missingFields = [] }: ProfileReminderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if dismissed in localStorage
    const dismissedUntil = localStorage.getItem(`profile_reminder_dismissed_${user.name}`);
    if (!dismissedUntil || new Date().getTime() > parseInt(dismissedUntil)) {
      setIsVisible(true);
    }
    setIsInitialized(true);
  }, [user.name]);

  const handleDismiss = () => {
    setIsVisible(false);
    // Dismiss for 24 hours
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);
    localStorage.setItem(`profile_reminder_dismissed_${user.name}`, tomorrow.getTime().toString());
  };

  const handleOpenProfile = async () => {
    setIsLoading(true);
    try {
      const result = await getUserProfile();
      if (result.success) {
        setUserData(result.data);
        setProfileOpen(true);
      } else {
        toast.error("Failed to load profile details");
      }
    } catch (error) {
      toast.error("An error occurred while loading profile");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized || !isVisible) return null;

  return (
    <>
      <div className={cn(
        "relative overflow-hidden group rounded-sm border border-amber-200/50 bg-amber-50/30 p-3 sm:p-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500",
        "dark:bg-amber-500/5 dark:border-amber-500/20"
      )}>
        {/* Background Decorative Pattern */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-[0.03] dark:opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <User size={120} />
        </div>

        <div className="flex items-start gap-3 sm:gap-4 relative z-10">
          <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-sm bg-amber-100 flex items-center justify-center text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <AlertCircle className="size-4 sm:size-5 animate-pulse-soft" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 sm:block">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 tracking-tight">Complete Your Profile</h3>
              <button 
                onClick={handleDismiss}
                className="sm:hidden p-1 text-amber-400 hover:text-amber-600 dark:text-amber-500/40 dark:hover:text-amber-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-800/70 dark:text-amber-400/60 mt-1 leading-relaxed max-w-2xl">
              Your profile is incomplete. Missing: <span className="font-bold text-amber-900/80 dark:text-amber-300/80">{missingFields.join(", ")}</span>. 
              Please provide these details to keep your records up to date.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleOpenProfile}
                disabled={isLoading}
                className="h-8 text-[10px] font-black uppercase tracking-widest border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:hover:bg-amber-500/20 dark:text-amber-400 w-full sm:w-auto"
              >
                Update Profile Now
                <ArrowRight className="ml-2 size-3" />
              </Button>
              <button 
                onClick={handleDismiss}
                className="text-[10px] font-bold text-amber-700/50 hover:text-amber-700 dark:text-amber-500/50 dark:hover:text-amber-500 transition-colors uppercase tracking-widest px-1 py-2 sm:py-0 text-center"
              >
                Remind me later
              </button>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="hidden sm:block shrink-0 p-1 text-amber-400 hover:text-amber-600 dark:text-amber-500/40 dark:hover:text-amber-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {userData && (
        <ProfileDialog 
          user={userData} 
          open={profileOpen} 
          onOpenChange={setProfileOpen} 
        />
      )}
    </>
  );
}
