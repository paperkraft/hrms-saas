import { Plane, CalendarDays, Hourglass, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaveRequest {
  id: string;
  category: string;
  leaveType?: string | null;
  duration: string;
  startDate: Date;
  endDate: Date;
  status: string;
  days?: number;
}

interface UpcomingLeaveProps {
  requests: LeaveRequest[];
}

export function UpcomingLeave({ requests }: UpcomingLeaveProps) {
  const activeRequests = requests.filter(r => r.status === "PENDING" || r.status === "APPROVED").slice(0, 10);

  const getLeaveLabel = (request: LeaveRequest) => {
    if (request.duration === "SHORT") return "Short Leave";
    if (request.category === "UNPAID") return "Unpaid Leave";
    if (request.category === "SEMI_ANNUAL_POLICY_2") return "Semi-Annual";
    if (request.category === "MONTHLY_POLICY_1") {
      if (request.leaveType === "CASUAL") return "Casual Leave";
      if (request.leaveType === "MEDICAL") return "Medical Leave";
      return "Paid Leave";
    }
    return "Leave";
  };

  const formatDateRange = (start: Date, end: Date) => {
    const s = new Date(start);
    const e = new Date(end);
    const sStr = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (s.toDateString() === e.toDateString()) {
      return sStr;
    }
    const eStr = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${sStr} - ${eStr}`;
  };

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs animate-fade-in">
      <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Plane className="size-3.5 text-primary shrink-0" /> Upcoming Leave
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              {activeRequests.length} Scheduled
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Approved upcoming departures and team absence calendar.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/40 flex-1 overflow-y-auto scrollbar-hide">
        {activeRequests.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center text-muted-foreground gap-2">
            <CalendarDays className="size-8 opacity-40" />
            <p className="text-xs font-semibold">No scheduled departures</p>
          </div>
        ) : (
          activeRequests.map((request) => {
            const label = getLeaveLabel(request);
            const dateDisplay = formatDateRange(request.startDate, request.endDate);
            const days = request.days || 1;

            return (
              <div key={request.id} className="px-5 py-3.5 flex items-center justify-between group hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "size-9 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                    request.status === "PENDING" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  )}>
                    {request.status === "PENDING" ? <Hourglass className="size-4" /> : <CheckCircle2 className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border",
                        request.status === "PENDING" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      )}>
                        {request.status === "PENDING" ? "Pending" : "Confirmed"}
                      </span>
                      <p className="text-[10px] text-muted-foreground font-medium truncate">
                        {dateDisplay}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4 flex flex-col items-end">
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    {days}
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{days === 1 ? 'DAY' : 'DAYS'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

