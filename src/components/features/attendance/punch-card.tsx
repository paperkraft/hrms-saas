'use client';
import { useState, useEffect, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { punchInOutAction } from "@/actions/attendance";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, CheckCircle2, Loader2, AlertCircle, LogIn, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDistanceInMeters } from "@/lib/geofencing";
import { useRouter } from "next/navigation";

// Dynamically import the map so it never runs on the server
const GeoMapPanel = dynamic(
  () => import("./geo-map-panel").then(m => m.GeoMapPanel),
  { ssr: false, loading: () => <div className="w-full h-40 rounded-sm bg-muted/10 border border-border/40 animate-pulse" /> }
);

interface OfficeLocation {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

interface AttendanceCardProps {
  initialStatus: "PENDING" | "PUNCHED_IN" | "PUNCHED_OUT";
  punchInTime?: Date | string | null;
  autoPunchOutCount?: number;
  warningThreshold?: number;
  officeLocation?: OfficeLocation | null;
  officeLocations?: OfficeLocation[];
}

export function AttendanceCard({
  initialStatus,
  punchInTime,
  autoPunchOutCount = 0,
  warningThreshold = 3,
  officeLocation,
  officeLocations = [],
}: AttendanceCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();

  // Geo state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Dynamically find the closest allowed office location to center the map and geofence circle
  const activeOffice = useMemo(() => {
    if (!officeLocations || officeLocations.length === 0) {
      return officeLocation || null;
    }
    if (!userCoords) {
      const valid = officeLocations.find(loc => loc.lat != null && loc.lng != null);
      return valid || officeLocation || null;
    }
    let closest = officeLocations[0];
    let minDistance = Infinity;
    for (const loc of officeLocations) {
      if (loc.lat == null || loc.lng == null) continue;
      const d = getDistanceInMeters(userCoords.lat, userCoords.lng, loc.lat, loc.lng);
      if (d < minDistance) {
        minDistance = d;
        closest = loc;
      }
    }
    return closest;
  }, [officeLocations, officeLocation, userCoords]);

  useEffect(() => { setStatus(initialStatus); }, [initialStatus]);

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Passive location fetch on mount to show map
  useEffect(() => {
    const hasOffice = officeLocation || (officeLocations && officeLocations.length > 0);
    if (!hasOffice || typeof window === "undefined" || !navigator.geolocation) return;
    setIsAcquiringLocation(true);

    const acquireCoords = (options: PositionOptions, onFail?: () => void) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          setShowMap(true);
          setIsAcquiringLocation(false);
        },
        () => {
          if (onFail) {
            onFail();
          } else {
            setIsAcquiringLocation(false);
          }
        },
        options
      );
    };

    // First attempt high accuracy GPS; fallback to low accuracy / cellular cache if timeout occurs
    acquireCoords(
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
      () => {
        acquireCoords(
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
          () => setIsAcquiringLocation(false)
        );
      }
    );
  }, [officeLocation, officeLocations]);

  const handleRefreshLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setIsAcquiringLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setShowMap(true);
        setIsAcquiringLocation(false);
        toast.success("Location updated successfully");
      },
      () => {
        setIsAcquiringLocation(false);
        toast.error("Unable to acquire high-accuracy GPS. Please check location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Force fresh GPS satellite query
    );
  };

  // Check-out confirmation dialog state
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);

  const executePunch = (targetStatus: "PUNCHED_IN" | "PUNCHED_OUT") => {
    startTransition(async () => {
      let coords = undefined;

      try {
        if (!navigator.geolocation) {
          toast.error("Geolocation is not supported by your browser.");
          return;
        }

        toast.info("Verifying GPS lock...", {
          description: "Establishing precise location.",
          duration: 2000
        });

        let position: GeolocationPosition;
        try {
          // Attempt 1: Fast high-accuracy satellite query (force fresh, no cache)
          position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 3000,
              maximumAge: 0 // Force fresh satellite check, no cached data
            });
          });
        } catch (highAccuracyErr) {
          console.warn("[GEO] High-accuracy GPS timed out or failed indoors. Trying cell/Wi-Fi triangulation...", highAccuracyErr);

          // Attempt 2: Medium/low accuracy triangulation fallback (force fresh, no cache)
          position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 3000,
              maximumAge: 30000 // Force fresh cell/Wi-Fi check, 30 sec cached data
            });
          });
        }

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        coords = { lat, lng, accuracy: position.coords.accuracy };
        setUserCoords({ lat, lng, accuracy: position.coords.accuracy });
        setShowMap(true);
      } catch (err: any) {
        let errorMsg = "Please enable location services to continue.";
        if (err.code === 1) errorMsg = "Location access denied. Please enable it in browser settings.";
        else if (err.code === 3) errorMsg = "Location request timed out. Please ensure GPS is active and try again.";
        toast.error(errorMsg, { description: "Required for attendance verification.", duration: 5000 });
        return;
      }

      const result = await punchInOutAction(coords);
      if (result?.success) {
        setStatus(targetStatus);
        // Haptic feedback
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(targetStatus === "PUNCHED_IN" ? [80] : [60, 60, 80]);
        }
        toast.success(`Session ${targetStatus === "PUNCHED_IN" ? "started" : "ended"} successfully`, {
          description: targetStatus === "PUNCHED_IN" ? "Checked in successfully!" : "Checked out successfully!",
          duration: 3000
        });
        router.refresh();
      } else {
        toast.error("Process failed: " + result?.error);
      }
    });
  };

  const handleButtonClick = () => {
    if (status === "PENDING") {
      executePunch("PUNCHED_IN");
    } else if (status === "PUNCHED_IN") {
      // Require explicit confirmation before checking out to prevent accidental double-taps
      setShowCheckOutConfirm(true);
    }
  };

  const isWithinRange = useMemo(() => {
    if (!userCoords) return false;
    const allLocs = (officeLocations && officeLocations.length > 0)
      ? officeLocations
      : (activeOffice ? [activeOffice] : []);
    if (allLocs.length === 0) return true;
    return allLocs.some(loc => {
      if ((loc as any).isRemote) return true;
      if (loc.lat == null || loc.lng == null) return false;
      const d = getDistanceInMeters(userCoords.lat, userCoords.lng, loc.lat, loc.lng);
      const buffer = Math.min(Math.max(50, userCoords.accuracy || 0), 200);
      return d <= (loc.radiusMeters + buffer);
    });
  }, [userCoords, officeLocations, activeOffice]);

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden h-full flex flex-col shadow-2xs animate-fade-in group">
      <div className="p-6 flex-1 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        {/* Subtle Decorative Element */}
        <div className="absolute -top-4 -right-4 opacity-[0.03] select-none pointer-events-none group-hover:rotate-12 transition-transform duration-700">
          <Clock className="size-32" />
        </div>

        {/* Clock */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Digital Time
          </div>
          <div className="text-5xl text-foreground font-bold tabular-nums tracking-tight">
            {currentTime ? (
              <span className="flex items-baseline gap-1">
                {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}
              </span>
            ) : "--:--"}
          </div>
        </div>

        {/* Punch button */}
        <div className="flex flex-col items-center gap-4 w-full max-w-60 px-4">
          {status === "PUNCHED_OUT" ? (
            <div className="flex flex-col items-center justify-center gap-3 animate-scale-in w-full">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-6 py-3 rounded-md border border-emerald-500/20 w-full justify-center shadow-xs">
                <CheckCircle2 className="size-4" />
                <span className="font-bold text-xs uppercase tracking-wider leading-none">Shift Finalized</span>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              className={cn(
                "w-full h-12 text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-200 relative overflow-hidden border shadow-xs cursor-pointer",
                status === "PUNCHED_IN"
                  ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600/30"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent"
              )}
              disabled={isPending}
              onClick={handleButtonClick}
            >
              <div className="relative flex items-center justify-center gap-2">
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : status === "PENDING" ? (
                  <><LogIn className="size-4" /> Check In</>
                ) : (
                  <><LogOut className="size-4" /> Check Out</>
                )}
              </div>
            </Button>
          )}

          {status === "PUNCHED_IN" && !isPending && (
            <div className="flex flex-col items-center gap-2 animate-fade-in">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Session</span>
              </div>
              {punchInTime && (
                <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground/60" />
                  <span>
                    Started at {new Date(punchInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Check-Out Confirmation Dialog */}
        <AlertDialog open={showCheckOutConfirm} onOpenChange={setShowCheckOutConfirm}>
          <AlertDialogContent className="rounded-md border-border/80 shadow-2xl max-w-sm">
            <AlertDialogHeader className="space-y-2">
              <div className="size-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-1">
                <LogOut className="size-5" />
              </div>
              <AlertDialogTitle className="text-center text-base font-bold tracking-tight">
                Confirm Check Out
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to end your active work session and check out for today?
                {punchInTime && (
                  <span className="block mt-2 font-medium text-foreground">
                    Active session started at {new Date(punchInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2 mt-2">
              <AlertDialogCancel className="h-9 rounded-md text-xs font-semibold">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowCheckOutConfirm(false);
                  executePunch("PUNCHED_OUT");
                }}
                className="h-9 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold border-0 cursor-pointer"
              >
                Yes, Check Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Geo Map Panel ── */}
        {activeOffice && (
          <div className="w-full px-0 md:hidden mt-2">
            <div className="space-y-1.5 w-full">
              <GeoMapPanel
                userLat={userCoords?.lat ?? null}
                userLng={userCoords?.lng ?? null}
                officeLat={activeOffice.lat}
                officeLng={activeOffice.lng}
                radiusMeters={activeOffice.radiusMeters}
                officeName={activeOffice.name}
                isWithinRange={isWithinRange}
                accuracyMeters={userCoords?.accuracy}
              />
              <div className="flex items-center justify-between pt-0.5 px-0.5">
                {isAcquiringLocation ? (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground animate-pulse">
                    <Loader2 className="size-3 animate-spin text-primary" />
                    <span>Acquiring GPS…</span>
                  </div>
                ) : !userCoords ? (
                  <span className="text-[9px] font-medium text-amber-600/90 dark:text-amber-400">
                    Location lock pending
                  </span>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={handleRefreshLocation}
                  disabled={isAcquiringLocation}
                  className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors flex items-center gap-1 py-1 px-1.5 rounded-md hover:bg-primary/5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={cn("size-3", isAcquiringLocation && "animate-spin")} />
                  Refresh Location
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auto punch-out warning */}
        {autoPunchOutCount >= warningThreshold && (
          <div className="w-full bg-rose-500/5 border border-rose-500/20 rounded-md p-3.5 flex gap-3 animate-fade-in">
            <AlertCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">System Warning</p>
              <p className="text-[10px] text-muted-foreground leading-snug font-medium">
                Detected {autoPunchOutCount} auto-closures. Ensure manual check-out.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
