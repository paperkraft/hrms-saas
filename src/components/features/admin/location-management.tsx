"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  MapPin,
  Clock,
  Plus,
  Edit2,
  Crosshair,
  Save,
  X,
  Globe,
  Home,
  Building2,
  Trash2,
  Loader2,
  Search,
  AlertCircle,
  Radio,
  Navigation
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { upsertLocation, deleteLocation } from "@/actions/settings"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function LocationMiniMap({
  lat,
  lng,
  radiusMeters,
  locationName
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  locationName: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    if (!mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (!active || !mapRef.current) return;
      if (mapInstanceRef.current) return;
      if ((mapRef.current as any)._leaflet_id) return;

      // Fix default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
      }).setView([lat, lng], 15);

      mapInstanceRef.current = map;

      if (!active) {
        map.remove();
        mapInstanceRef.current = null;
        return;
      }

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Office radius circle
      L.circle([lat, lng], {
        radius: radiusMeters,
        color: "#6366f1",
        fillColor: "#6366f1",
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: "4 4",
      }).addTo(map);

      // Office marker
      const officeIcon = L.divIcon({
        html: `<div style="background:#6366f1;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        className: "",
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([lat, lng], { icon: officeIcon }).addTo(map);
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
  }, [lat, lng, radiusMeters]);

  return <div ref={mapRef} className="h-28 w-full border border-border/70 rounded-md bg-muted/20 overflow-hidden relative" />;
}

function LocationPickerMap({
  lat,
  lng,
  radiusMeters,
  onChange
}: {
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      if (!active || !mapRef.current) return;
      if (mapInstanceRef.current) return;
      if ((mapRef.current as any)._leaflet_id) return;

      const initialLat = lat || 28.6139;
      const initialLng = lng || 77.2090;

      const map = L.map(mapRef.current, {
        zoomControl: true,
      }).setView([initialLat, initialLng], 14);

      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Office icon
      const officeIcon = L.divIcon({
        html: `<div style="background:#6366f1;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (lat && lng) {
        markerRef.current = L.marker([lat, lng], { icon: officeIcon, draggable: true }).addTo(map);
        circleRef.current = L.circle([lat, lng], {
          radius: radiusMeters,
          color: "#6366f1",
          fillColor: "#6366f1",
          fillOpacity: 0.12,
          weight: 2,
        }).addTo(map);

        markerRef.current.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          circleRef.current?.setLatLng(pos);
          onChange(pos.lat, pos.lng);
        });
      }

      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        onChange(clickLat, clickLng);

        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
          circleRef.current?.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { icon: officeIcon, draggable: true }).addTo(map);
          circleRef.current = L.circle([clickLat, clickLng], {
            radius: radiusMeters,
            color: "#6366f1",
            fillColor: "#6366f1",
            fillOpacity: 0.12,
            weight: 2,
          }).addTo(map);

          markerRef.current.on("dragend", (evt: any) => {
            const pos = evt.target.getLatLng();
            circleRef.current?.setLatLng(pos);
            onChange(pos.lat, pos.lng);
          });
        }
      });
    });

    return () => {
      active = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map elements when lat/lng change from outside
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && circleRef.current && lat && lng) {
      const newPos = [lat, lng] as [number, number];
      markerRef.current.setLatLng(newPos);
      circleRef.current.setLatLng(newPos);
      mapInstanceRef.current.panTo(newPos);
    }
  }, [lat, lng]);

  // Update circle radius when radiusMeters change
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radiusMeters);
    }
  }, [radiusMeters]);

  return <div ref={mapRef} className="h-60 w-full border border-border/70 rounded-md bg-muted/20 overflow-hidden relative mt-3 animate-fade-in" />;
}

interface Location {
  id: string;
  name: string;
  address?: string | null;
  startTime: string;
  endTime: string;
  lat?: number | null;
  lng?: number | null;
  radiusMeters: number;
  graceTimeMinutes: number;
  isRemote: boolean;
}

const inputClass = "h-9 bg-background border-border/80 focus:ring-primary/20 rounded-md text-xs font-medium"
const labelClass = "text-xs font-semibold text-foreground"

export function LocationManagement({ initialLocations }: { initialLocations: Location[] }) {
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ONSITE" | "REMOTE">("ALL")

  const [formData, setFormData] = useState<Partial<Location>>({
    name: "",
    startTime: "09:30",
    endTime: "18:00",
    radiusMeters: 50,
    graceTimeMinutes: 10,
    isRemote: false
  })

  const resetForm = () => {
    setFormData({ name: "", startTime: "09:30", endTime: "18:00", radiusMeters: 50, graceTimeMinutes: 10, isRemote: false })
    setEditingId(null)
    setIsAdding(false)
  }

  const handleEdit = (loc: Location) => {
    setFormData(loc)
    setEditingId(loc.id)
    setIsAdding(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Location name is required")
      return
    }

    setLoading(true)
    const result = await upsertLocation(formData as any)
    if (result.success) {
      if (editingId) {
        setLocations(prev => prev.map(l => l.id === editingId ? result.data : l))
        toast.success("Location updated successfully!")
      } else {
        setLocations(prev => [...prev, result.data])
        toast.success("New location created successfully!")
      }
      resetForm()
    } else {
      toast.error(result.error || "Failed to save location")
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const result = await deleteLocation(id)
    if (result.success) {
      setLocations(prev => prev.filter(l => l.id !== id))
      toast.success("Location deleted successfully!")
    } else {
      toast.error(result.error || "Failed to delete location")
    }
    setDeletingId(null)
  }

  // Summary Metrics
  const onSiteCount = locations.filter(l => !l.isRemote).length
  const remoteCount = locations.filter(l => l.isRemote).length

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter(l => {
      const term = searchTerm.toLowerCase()
      const matchesSearch = l.name.toLowerCase().includes(term) ||
        (l.address && l.address.toLowerCase().includes(term)) ||
        l.id.toLowerCase().includes(term)

      const matchesType = typeFilter === "ALL" ? true :
        typeFilter === "ONSITE" ? !l.isRemote : l.isRemote

      return matchesSearch && matchesType
    })
  }, [locations, searchTerm, typeFilter])

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Summary Counters ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Total Locations</span>
            <span className="text-xl font-bold tracking-tight text-foreground font-mono mt-1 block">
              {locations.length}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-primary/10 text-primary border border-primary/20">
            <Building2 className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">On-site Hubs</span>
            <span className="text-xl font-bold tracking-tight text-emerald-600 font-mono mt-1 block">
              {onSiteCount}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <MapPin className="size-5" />
          </div>
        </div>

        <div className="bg-card border border-border/80 rounded-md p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block">Remote Hubs</span>
            <span className="text-xl font-bold tracking-tight text-sky-600 font-mono mt-1 block">
              {remoteCount}
            </span>
          </div>
          <div className="p-2.5 rounded-md bg-sky-500/10 text-sky-600 border border-sky-500/20">
            <Home className="size-5" />
          </div>
        </div>
      </div>

      {/* ── Add / Edit Location Card ── */}
      {isAdding && (
        <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
          <div className="p-4 border-b border-border/70 flex items-center justify-between bg-card">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-md flex items-center justify-center border border-primary/20 bg-primary/10 text-primary shrink-0">
                <MapPin className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">
                  {editingId ? "Edit Location Parameters" : "Register New Location"}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">Define office address, timings, and GPS proximity radius</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-8 rounded-md hover:bg-muted cursor-pointer" onClick={resetForm}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="p-5 space-y-4">
            {/* Name & Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={labelClass}>Location Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Corporate HQ, Tech Hub, Branch 1"
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Street Address</Label>
                <Input
                  value={formData.address || ""}
                  onChange={(e) => setFormData(p => ({ ...p, address: e.target.value }))}
                  placeholder="Street address, city, state"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Timings & Parameters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="space-y-1.5">
                <Label className={labelClass}>Shift Start</Label>
                <Input type="time" value={formData.startTime} onChange={(e) => setFormData(p => ({ ...p, startTime: e.target.value }))} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Shift End</Label>
                <Input type="time" value={formData.endTime} onChange={(e) => setFormData(p => ({ ...p, endTime: e.target.value }))} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Grace (Mins)</Label>
                <Input type="number" min="0" value={formData.graceTimeMinutes} onChange={(e) => setFormData(p => ({ ...p, graceTimeMinutes: Number(e.target.value) }))} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Geofence Radius (m)</Label>
                <Input type="number" min="10" value={formData.radiusMeters} onChange={(e) => setFormData(p => ({ ...p, radiusMeters: Number(e.target.value) }))} className={inputClass} />
              </div>
            </div>

            {/* Remote Hub Switcher */}
            <div className="flex items-center justify-between py-3 px-3.5 rounded-md border border-border/70 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <Home className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-bold text-foreground">Remote Work Hub</p>
                  <p className="text-[11px] text-muted-foreground font-medium">Bypasses strict physical GPS proximity verification during attendance punch</p>
                </div>
              </div>
              <Switch
                checked={formData.isRemote ?? false}
                onCheckedChange={(val) => setFormData(p => ({ ...p, isRemote: val }))}
                className="data-[state=checked]:bg-primary cursor-pointer"
              />
            </div>

            {/* GPS Coordinates (only if physical) */}
            {!formData.isRemote && (
              <div className="p-4 border border-border/70 rounded-md bg-muted/20 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="size-3.5 text-primary" /> GPS Coordinates & Geofence Picker
                  </p>
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs font-semibold rounded-md border-border/80 hover:bg-muted cursor-pointer transition-all flex items-center gap-1.5"
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        toast.error("Geolocation is not supported by your browser")
                        return
                      }
                      navigator.geolocation.getCurrentPosition(
                        pos => {
                          setFormData(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }))
                          toast.success("Captured your current coordinates!")
                        },
                        () => {
                          toast.error("Could not retrieve your location. Please ensure location permissions are granted.")
                        }
                      )
                    }}
                  >
                    <Crosshair className="size-3.5" /> Use Current Location
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Latitude</Label>
                    <Input type="number" step="any" value={formData.lat || ""} onChange={(e) => setFormData(p => ({ ...p, lat: Number(e.target.value) }))} className={inputClass} placeholder="e.g. 28.6139" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Longitude</Label>
                    <Input type="number" step="any" value={formData.lng || ""} onChange={(e) => setFormData(p => ({ ...p, lng: Number(e.target.value) }))} className={inputClass} placeholder="e.g. 77.2090" />
                  </div>
                </div>

                <LocationPickerMap
                  lat={formData.lat || null}
                  lng={formData.lng || null}
                  radiusMeters={formData.radiusMeters || 50}
                  onChange={(lat, lng) => setFormData(p => ({ ...p, lat, lng }))}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
              <Button variant="outline" onClick={resetForm} className="h-9 px-4 text-xs font-semibold rounded-md border-border/80 cursor-pointer">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading} className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <><Save className="size-3.5" />{editingId ? "Update Location" : "Save Location"}</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Locations Registry & Filter Toolbar ── */}
      <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border/70 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 bg-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-md flex items-center justify-center border border-primary/20 bg-primary/10 text-primary shrink-0">
                <Globe className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight leading-none mb-1">Office Locations</h3>
                <p className="text-xs text-muted-foreground font-medium">Physical company offices and remote attendance hubs</p>
              </div>
            </div>

            {!isAdding && (
              <Button
                className="md:hidden h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5 shrink-0"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="size-3.5" /> Add
              </Button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search locations or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-xs bg-background border-border/80 rounded-md focus:ring-primary/20"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
                >
                  <X className="size-3 text-muted-foreground/50" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center bg-muted/40 p-1 rounded-md border border-border/70">
              {[
                { value: "ALL", label: "All" },
                { value: "ONSITE", label: "On-site" },
                { value: "REMOTE", label: "Remote" },
              ].map((st) => (
                <button
                  key={st.value}
                  onClick={() => setTypeFilter(st.value as any)}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                    typeFilter === st.value
                      ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {!isAdding && (
              <Button
                className="hidden md:flex h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer gap-1.5 shrink-0"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="size-3.5" /> Add Location
              </Button>
            )}
          </div>
        </div>

        {/* ── Locations Cards Grid ── */}
        {filteredLocations.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-2 opacity-40">
            <Globe className="size-8 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider">No office locations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4 bg-muted/10">
            {filteredLocations.map(loc => (
              <div
                key={loc.id}
                className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="p-3.5 border-b border-border/70 flex items-center justify-between bg-card">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "size-8 rounded-md flex items-center justify-center border shrink-0",
                        loc.isRemote
                          ? "bg-sky-500/10 text-sky-600 border-sky-500/20"
                          : "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {loc.isRemote ? <Home className="size-4" /> : <MapPin className="size-4" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground leading-none truncate" title={loc.name}>
                          {loc.name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          #{loc.id.slice(-4).toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                      loc.isRemote
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    )}>
                      {loc.isRemote ? "Remote Hub" : "On-site Office"}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 space-y-3">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground/70" />
                        <span>{loc.startTime} — {loc.endTime}</span>
                      </div>
                      <span>{loc.graceTimeMinutes}m grace</span>
                    </div>

                    {!loc.isRemote && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30 border border-border/70 rounded-md text-xs font-semibold text-foreground/80">
                        <Crosshair className="size-3 text-muted-foreground" />
                        <span>{loc.radiusMeters}m geofence radius</span>
                      </div>
                    )}

                    {/* Map Display */}
                    {!loc.isRemote && loc.lat && loc.lng && (
                      <div className="mt-1">
                        <LocationMiniMap lat={loc.lat} lng={loc.lng} radiusMeters={loc.radiusMeters} locationName={loc.name} />
                      </div>
                    )}

                    {loc.address && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {loc.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 border-t border-border/60 flex items-center justify-end gap-1.5 bg-muted/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer transition-all gap-1"
                    onClick={() => handleEdit(loc)}
                  >
                    <Edit2 className="size-3" />
                    <span>Edit</span>
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-md cursor-pointer transition-all"
                        disabled={deletingId === loc.id}
                        title="Delete Location"
                      >
                        {deletingId === loc.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-md border border-border/80 shadow-2xl max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm font-bold text-rose-600 flex items-center gap-2">
                          <AlertCircle className="size-4" />
                          Delete Location Hub?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-muted-foreground">
                          Are you sure you want to delete <strong>{loc.name}</strong>? This action will remove this office hub from the system. (Locations with active assigned staff cannot be deleted).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="h-9 text-xs font-semibold rounded-md border-border/80">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(loc.id)}
                          className="h-9 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Location
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
