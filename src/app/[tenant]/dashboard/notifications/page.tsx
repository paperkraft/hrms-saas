import { NotificationList } from "@/components/features/notifications/notification-list";
import { ActiveDevices } from "@/components/features/notifications/active-devices";
import { PageContainer } from "@/components/ui";
import { BellRing } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="bg-card border border-border/80 rounded-xl p-5 lg:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <BellRing className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Notification & Alert Center
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Personal activity alerts, approval updates, reminder broadcasts, and registered push devices
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <NotificationList />
        </div>
        <div className="space-y-6">
          <ActiveDevices />
        </div>
      </div>
    </PageContainer>
  );
}
