"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Navigation, AlertTriangle, CheckCircle2, MapPin } from "lucide-react";

interface GeoMapPanelProps {
  userLat?: number | null;
  userLng?: number | null;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
  officeName: string;
  isWithinRange?: boolean;
  accuracyMeters?: number;
}

export function GeoMapPanel({
  userLat,
  userLng,
  officeLat,
  officeLng,
  radiusMeters,
  officeName,
  isWithinRange = false,
  accuracyMeters,
}: GeoMapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    if (!mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (!active || !mapRef.current) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if ((mapRef.current as any)._leaflet_id) {
        delete (mapRef.current as any)._leaflet_id;
      }

      // Fix default icon paths broken by Webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const hasUser = userLat != null && userLng != null;
      const centerLat = hasUser ? (userLat! + officeLat) / 2 : officeLat;
      const centerLng = hasUser ? (userLng! + officeLng) / 2 : officeLng;
      const initialZoom = hasUser ? 16 : 15;

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: true,
        boxZoom: false,
        keyboard: false,
      }).setView([centerLat, centerLng], initialZoom);

      mapInstanceRef.current = map;

      if (!active) {
        map.remove();
        mapInstanceRef.current = null;
        return;
      }

      // Tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Office radius circle
      L.circle([officeLat, officeLng], {
        radius: radiusMeters,
        color: hasUser && isWithinRange ? "#22c55e" : "#6366f1",
        fillColor: hasUser && isWithinRange ? "#22c55e" : "#6366f1",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "6 4",
      }).addTo(map);

      // Office marker (custom HTML)
      const officeIcon = L.divIcon({
        html: `<div style="background:${hasUser && isWithinRange ? "#22c55e" : "#6366f1"};width:16px;height:16px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.35)"></div>`,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([officeLat, officeLng], { icon: officeIcon })
        .addTo(map)
        .bindTooltip(officeName, { permanent: false, className: "leaflet-tooltip-sm" });

      if (hasUser) {
        // User marker (pulsing)
        const userIcon = L.divIcon({
          html: `<div style="position:relative;width:18px;height:18px"><div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.4);position:absolute;top:2px;left:2px"></div><div style="background:rgba(59,130,246,0.35);width:18px;height:18px;border-radius:50%;position:absolute;top:0;left:0;animation:ping 1.5s ease-in-out infinite"></div></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([userLat!, userLng!], { icon: userIcon })
          .addTo(map)
          .bindTooltip("You", { permanent: false });

        // Line between user and office
        L.polyline([[userLat!, userLng!], [officeLat, officeLng]], {
          color: "#94a3b8",
          weight: 1.5,
          dashArray: "4 4",
          opacity: 0.6,
        }).addTo(map);

        // Fit bounds to show both markers + radius
        const bounds = L.latLngBounds(
          [userLat!, userLng!],
          [officeLat, officeLng]
        ).pad(0.25);
        map.fitBounds(bounds);
      }

      // Ensure leaflet tiles render cleanly on mobile containers
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 600);
    });

    // Inject Leaflet CSS once
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    return () => {
      active = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLat, userLng, officeLat, officeLng, radiusMeters, isWithinRange, officeName]);

  // Calculate distance for display if user location is known
  let distanceDisplay: string | null = null;
  if (userLat != null && userLng != null) {
    const R = 6371e3;
    const φ1 = (userLat * Math.PI) / 180;
    const φ2 = (officeLat * Math.PI) / 180;
    const dφ = ((officeLat - userLat) * Math.PI) / 180;
    const dλ = ((officeLng - userLng) * Math.PI) / 180;
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
    const distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    distanceDisplay = distanceMeters < 1000 ? `${distanceMeters}m away` : `${(distanceMeters / 1000).toFixed(1)}km away`;
  }

  const hasUser = userLat != null && userLng != null;

  return (
    <div className="w-full animate-fade-in space-y-2">
      {/* Status banner */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md border text-[10px] font-bold uppercase tracking-wider",
        !hasUser
          ? "bg-muted/40 border-border/70 text-muted-foreground"
          : isWithinRange
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
      )}>
        {!hasUser ? (
          <>
            <MapPin className="size-3.5 shrink-0 text-primary" />
            <span>Designated Office: {officeName}</span>
          </>
        ) : isWithinRange ? (
          <>
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>Within Office Range</span>
          </>
        ) : (
          <>
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Outside Office Range</span>
          </>
        )}
        {distanceDisplay && (
          <span className="ml-auto font-bold text-muted-foreground normal-case tracking-normal">
            {distanceDisplay}
          </span>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-44 rounded-md overflow-hidden border border-border/80 bg-muted/20 shadow-2xs"
        style={{ zIndex: 0 }}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {hasUser && (
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">You</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn("size-2.5 rounded-full shrink-0", hasUser && isWithinRange ? "bg-emerald-500" : "bg-indigo-500")} />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{officeName}</span>
        </div>
        {accuracyMeters !== undefined && (
          <div className="ml-auto flex items-center gap-1">
            <Navigation className="size-3 text-muted-foreground/60" />
            <span className="text-[10px] font-medium text-muted-foreground/70">±{Math.round(accuracyMeters)}m</span>
          </div>
        )}
      </div>
    </div>
  );
}
