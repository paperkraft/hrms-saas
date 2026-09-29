"use client";

import { useState, useEffect } from "react";
import { getActiveDevices, revokeDevice } from "@/actions/push-subscription";
import { Button } from "@/components/ui/button";
import { Laptop, Smartphone, Trash2, Clock, Monitor } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ActiveDevices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    setLoading(true);
    const res = await getActiveDevices();
    if (res.success && res.data) {
      setDevices(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke push notifications for this device?")) return;

    const res = await revokeDevice(id);
    if (res.success) {
      toast.success("Device revoked successfully");
      fetchDevices();
    } else {
      toast.error("Failed to revoke device");
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-5 w-5" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="h-5 w-5 text-primary" />;
    }
    return <Laptop className="h-5 w-5 text-primary" />;
  };

  const parseDeviceName = (userAgent: string | null) => {
    if (!userAgent) return "Unknown Device";

    let os = "Unknown OS";
    let browser = "Unknown Browser";

    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac OS")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS";

    if (userAgent.includes("Chrome") && !userAgent.includes("Edg") && !userAgent.includes("OPR")) browser = "Chrome";
    else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Edg")) browser = "Edge";
    else if (userAgent.includes("OPR") || userAgent.includes("Opera")) browser = "Opera";

    return `${os} - ${browser}`;
  };

  return (
    <div className="bg-card border border-border/80 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Monitor className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">Active Push Devices</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Registered devices receiving instant alerts
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center animate-pulse opacity-60">
          <Monitor className="size-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-medium">Loading devices...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="py-8 text-center flex flex-col items-center gap-2 border border-dashed border-border/80 rounded-lg bg-background/50 p-4">
          <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center">
            <Monitor className="size-5 text-muted-foreground/50" />
          </div>
          <p className="text-xs font-bold text-foreground mt-1">No active devices</p>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Push notifications have not been enabled on any device yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {devices.map((device, index) => (
            <div
              key={device.id}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-lg border transition-all",
                index === 0
                  ? "border-primary/30 bg-primary/[0.03]"
                  : "border-border/70 bg-card hover:border-border"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={cn(
                    "size-9 rounded-lg flex items-center justify-center shrink-0 border",
                    index === 0
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-muted border-border/60 text-muted-foreground"
                  )}
                >
                  {getDeviceIcon(device.userAgent)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate">
                      {parseDeviceName(device.userAgent)}
                    </p>
                    {index === 0 && (
                      <span className="text-[9px] uppercase font-bold text-primary bg-primary/15 border border-primary/30 px-1.5 py-0.2 rounded shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                    <Clock className="size-3 shrink-0" />
                    <span className="truncate">
                      Subscribed {format(new Date(device.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRevoke(device.id)}
                className="size-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md shrink-0 cursor-pointer"
                title="Revoke push notifications for this device"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground/70 font-medium text-center pt-1">
            Max 2 devices active. Older sessions are replaced automatically.
          </p>
        </div>
      )}
    </div>
  );
}
