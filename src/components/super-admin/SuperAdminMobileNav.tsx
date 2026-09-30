"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShieldCheck, UserPlus, Server, HardDrive, Activity } from "lucide-react";
import { SuperAdminSidebarNav } from "./SuperAdminSidebarNav";
import { SuperAdminLogoutButton } from "./SuperAdminLogoutButton";

interface SuperAdminMobileNavProps {
  session: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
}

export function SuperAdminMobileNav({ session }: SuperAdminMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 -ml-2 rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer"
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Slide-over Drawer & Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sidebar */}
          <div className="relative w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border h-full flex flex-col justify-between shadow-2xl z-10 animate-slide-in-left">
            <div>
              {/* Header Branding */}
              <div className="h-14 border-b border-sidebar-border px-4 flex items-center justify-between">
                <Link
                  href="/super-admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 group min-w-0"
                >
                  <div className="size-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs shrink-0">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-bold text-sm tracking-tight text-sidebar-foreground block truncate">
                      Platform Admin
                    </span>
                    <span className="text-[10px] font-mono text-primary block tracking-wider uppercase truncate">
                      Multi-Tenant Core
                    </span>
                  </div>
                </Link>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="size-4.5" />
                </button>
              </div>

              {/* Quick Action Button */}
              <div className="p-3 border-b border-sidebar-border/60">
                <Link
                  href="/super-admin/tenants/onboarding"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-md shadow-xs transition"
                >
                  <UserPlus className="size-3.5" />
                  <span>Onboard New Tenant</span>
                </Link>
              </div>

              {/* Nav items */}
              <div className="py-2">
                <SuperAdminSidebarNav />
              </div>
            </div>

            {/* Footer Profile & Logout */}
            <div className="p-3 border-t border-sidebar-border bg-sidebar/50">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate min-w-0 flex-1">
                  <div className="text-xs font-semibold text-sidebar-foreground truncate">
                    {session?.name || "Platform Admin"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {session?.email || "superadmin@hrms.com"}
                  </div>
                </div>

                <SuperAdminLogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
