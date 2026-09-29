"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileText, CheckCircle2, MapPin, Timer, Calendar, ChevronLeft, ChevronRight, Clock, IndianRupee, Calculator } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function AccountantTabs() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "report";

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const tabs = [
    { id: "report", name: "Master Report", icon: FileText, href: "?tab=report" },
    { id: "ledger", name: "Attendance Ledger", icon: Calendar, href: "?tab=ledger" },
    { id: "approvals", name: "History & Recent Approvals", icon: CheckCircle2, href: "?tab=approvals" },
    { id: "allowances", name: "Allowance Requests", icon: MapPin, href: "?tab=allowances" },
    { id: "overtime", name: "Overtime Requests", icon: Timer, href: "?tab=overtime" },
    { id: "grievances", name: "Attendance Grievances", icon: Clock, href: "?tab=grievances" },
    { id: "payroll-settings", name: "Payroll Settings", icon: IndianRupee, href: "?tab=payroll-settings" },
    { id: "payroll-generation", name: "Salary Slips & Payroll", icon: FileText, href: "?tab=payroll-generation" },
    { id: "quick-slip", name: "Quick Payslip Generator", icon: Calculator, href: "?tab=quick-slip" },
  ];

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth / 2;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="flex items-center gap-2 w-full group">
      {/* Left Navigation Button */}
      {showLeft && (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-8 shrink-0 rounded-md bg-background border-border/80 shadow-xs"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex-1 overflow-x-auto scrollbar-hide min-w-0"
      >
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border/70 w-fit min-w-max">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            const href = tab.href +
              (searchParams.get("m") ? `&m=${searchParams.get("m")}` : "") +
              (searchParams.get("y") ? `&y=${searchParams.get("y")}` : "");

            return (
              <Link
                key={tab.id}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-3.5 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap",
                  isActive
                    ? "bg-card text-foreground font-bold shadow-xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <tab.icon className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right Navigation Button */}
      {showRight && (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-8 shrink-0 rounded-md bg-background border-border/80 shadow-xs"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
