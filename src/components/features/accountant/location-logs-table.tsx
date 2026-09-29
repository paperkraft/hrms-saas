"use client";

import React, { useState } from "react";
import { MapPin, Search, ExternalLink, Clock, Filter } from "lucide-react";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import { RevertCheckoutButton } from "./revert-checkout-button";

interface AttendanceLog {
  id: string;
  userName: string;
  avatarUrl?: string | null;
  date: Date;
  punchIn: Date;
  punchOut: Date | null;
  punchInLat: number | null;
  punchInLng: number | null;
  punchOutLat: number | null;
  punchOutLng: number | null;
  isOutsideOffice: boolean;
  ipAddress: string | null;
}

export function LocationLogsTable({ data }: { data: AttendanceLog[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOutsideOnly, setFilterOutsideOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredData = data.filter((log) => {
    const matchesSearch = log.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterOutsideOnly ? log.isOutsideOffice : true;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden shadow-2xs animate-fade-in">
      {/* Controls */}
      <div className="p-4 border-b border-border/70 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search by employee name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 border-border/80 focus:ring-primary/20 transition-all rounded-md text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border/60">
            {filteredData.length} Logs
          </span>
          <Button
            variant={filterOutsideOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilterOutsideOnly(!filterOutsideOnly);
              setCurrentPage(1);
            }}
            className={cn(
              "h-9 px-3.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
              filterOutsideOnly
                ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs"
                : "border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Filter className="size-3.5 mr-1.5" />
            {filterOutsideOnly ? "Outside Only" : "All Locations"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead className="bg-muted/30 border-b border-border/70">
            <tr>
              <th className="py-3.5 px-5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Employee</th>
              <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Date</th>
              <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Entry / Exit</th>
              <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">Geofence Status</th>
              <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">IN Coordinates</th>
              <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">OUT Coordinates</th>
              <th className="py-3.5 px-5 text-right text-xs font-bold text-muted-foreground whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <MapPin className="size-8 text-muted-foreground" />
                    <p className="text-xs font-semibold uppercase tracking-wider">No location records found</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((log) => (
                <tr key={log.id} className="hover:bg-muted/10 transition-colors group">
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3 min-w-[160px]">
                      <Avatar className="size-8 rounded-full shrink-0">
                        {log.avatarUrl && <AvatarImage src={log.avatarUrl} alt={log.userName} className="object-cover" />}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center size-full">
                          {getInitials(log.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground truncate">{log.userName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 whitespace-nowrap">
                          {log.ipAddress || "No IP logged"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex flex-col min-w-[85px]">
                      <span className="text-xs font-semibold text-foreground/90 whitespace-nowrap">
                        {(() => {
                          const d = new Date(log.date);
                          const utcDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
                          return format(utcDate, "dd MMM yyyy");
                        })()}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {(() => {
                          const d = new Date(log.date);
                          const utcDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
                          return format(utcDate, "EEEE");
                        })()}
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 min-w-[130px]">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 text-muted-foreground/60" />
                        <span className="text-xs font-semibold text-foreground/80 font-mono whitespace-nowrap">
                          {format(new Date(log.punchIn), "hh:mm a")}
                        </span>
                      </div>
                      {log.punchOut && (
                        <>
                          <span className="text-muted-foreground/40 font-bold">—</span>
                          <div className="flex items-center gap-1">
                            <Clock className="size-3 text-muted-foreground/60" />
                            <span className="text-xs font-semibold text-foreground/80 font-mono whitespace-nowrap">
                              {format(new Date(log.punchOut), "hh:mm a")}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="min-w-[90px]">
                      {log.isOutsideOffice ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
                          <MapPin className="size-3" /> Outside
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap">
                          <MapPin className="size-3" /> In Office
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="min-w-[130px]">
                      {log.punchInLat && log.punchInLng ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${log.punchInLat},${log.punchInLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono font-semibold text-primary hover:underline transition-all whitespace-nowrap inline-flex items-center gap-1"
                          title="View In-Punch Location on Map"
                        >
                          <ExternalLink className="size-3 text-primary/70" />
                          {log.punchInLat.toFixed(4)}, {log.punchInLng.toFixed(4)}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 font-mono">—</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="min-w-[130px]">
                      {log.punchOutLat && log.punchOutLng ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${log.punchOutLat},${log.punchOutLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono font-semibold text-primary hover:underline transition-all whitespace-nowrap inline-flex items-center gap-1"
                          title="View Out-Punch Location on Map"
                        >
                          <ExternalLink className="size-3 text-primary/70" />
                          {log.punchOutLat.toFixed(4)}, {log.punchOutLng.toFixed(4)}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 font-mono">—</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-2 min-w-[90px]">
                      {log.punchOut && format(new Date(log.date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && (
                        <RevertCheckoutButton logId={log.id} userName={log.userName} />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-border/70 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Show
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(val) => {
                setPageSize(parseInt(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[72px] text-xs font-semibold border-border/80 bg-background rounded-md">
                <SelectValue placeholder={pageSize.toString()} />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                {[5, 10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={size.toString()} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs font-medium text-muted-foreground border-l border-border/60 pl-3">
            Page {currentPage} of {totalPages || 1}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-semibold rounded-md border-border/80 hover:bg-muted transition-all disabled:opacity-30 cursor-pointer"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>

          <div className="flex items-center gap-1 px-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              if (
                totalPages > 5 &&
                p !== 1 &&
                p !== totalPages &&
                Math.abs(p - currentPage) > 1
              ) {
                if (p === 2 || p === totalPages - 1) return <span key={p} className="text-muted-foreground text-xs px-1">...</span>;
                return null;
              }
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={cn(
                    "size-7 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    currentPage === p
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-semibold rounded-md border-border/80 hover:bg-muted transition-all disabled:opacity-30 cursor-pointer"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
