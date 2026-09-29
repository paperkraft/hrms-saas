"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavigationForUser } from "@/config/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { appConfig } from "@/lib/app-config";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar
} from "@/components/ui/sidebar";

export function Sidebar({
  userRole,
  isTeamLeader,
  userAllowedMenus,
  isExternal,
  tenantSlug,
}: {
  userRole: string;
  isTeamLeader: boolean;
  userAllowedMenus?: string[];
  isExternal?: boolean;
  tenantSlug?: string;
}) {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const navGroups = getNavigationForUser({
    userRole,
    isTeamLeader,
    userAllowedMenus,
    isExternal
  });

  const normalizedPathname = pathname ? pathname.replace(/^\/[^/]+(?=\/dashboard)/, "") : pathname;
  const homeHref = tenantSlug ? `/${tenantSlug}/dashboard` : "/dashboard";

  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader className="h-14 border-b border-sidebar-border p-0 flex items-center justify-center overflow-hidden">
        <Link href={homeHref} className="flex items-center group-data-[collapsible=icon]:justify-center w-full transition-all duration-200">
          <div className="flex items-center min-w-0">
            <Image
              src={appConfig.logoUrl}
              alt={appConfig.appName}
              width={160}
              height={50}
              className="h-9 w-auto shrink-0 group-data-[collapsible=icon]:hidden px-6"
              priority
            />
            <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-8 h-8">
              <Image
                src={appConfig.appLogoUrl}
                alt={appConfig.companyName.charAt(0)}
                width={32}
                height={32}
                className="h-7 w-auto"
                priority
              />
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="custom-scrollbar pb-8">
        {navGroups.map((group) => {
          const visibleItems = group.items;
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel className="px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isProjectOverview = item.href === "/dashboard/projects";
                    const isSubProjectPage = (normalizedPathname.startsWith("/dashboard/projects/") || pathname.startsWith("/dashboard/projects/")) &&
                      !normalizedPathname.includes("/reports") &&
                      !normalizedPathname.includes("/activity") &&
                      !normalizedPathname.includes("/task-master");

                    const isActive = pathname === item.href || normalizedPathname === item.href || (isProjectOverview && isSubProjectPage);
                    const linkHref = tenantSlug ? `/${tenantSlug}${item.href}` : item.href;

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className={cn(
                            "transition-all duration-200 group-data-[collapsible=icon]:justify-center",
                            isActive
                              ? "bg-primary/5 text-primary font-bold"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-primary"
                          )}
                        >
                          <Link
                            href={linkHref}
                            className="flex items-center w-full group-data-[collapsible=icon]:justify-center"
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <item.icon className={cn(
                              "size-4 shrink-0 transition-all duration-200",
                              isActive ? "text-primary" : "text-sidebar-foreground group-hover/menu-button:text-primary"
                            )} />
                            <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                            {isActive && (
                              <div className="ml-auto w-1 h-1 rounded-full bg-primary group-data-[collapsible=icon]:hidden" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarRail />
    </SidebarRoot>
  );
}
