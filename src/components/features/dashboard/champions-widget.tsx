import { getMonthlyChampions } from "@/actions/dashboard/reports";
import { Trophy, Star, Medal, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export async function ChampionsWidget() {
  const result = await getMonthlyChampions();
  if (!result.success || !result.data) return null;
  const { liveEmployee, liveTl, liveTeam, prevEmployee, prevTl, prevTeam } = result.data;

  if (!liveEmployee && !liveTl && !liveTeam && !prevEmployee && !prevTl && !prevTeam) return null;

  const renderItem = (champion: any, type: "employee" | "leader" | "team", title: string) => {
    if (!champion) return null;
    
    const isEmployee = type === "employee";
    const isTeam = type === "team";

    const name = isTeam ? champion.department : (isEmployee ? champion.name : champion.tlName);
    const scoreValue = isTeam ? champion.averageScore : (isEmployee ? champion.overallScore : `${champion.bayesianOTRR || 0}%`);
    const scoreLabel = isTeam ? "AVG PTS" : (isEmployee ? "PTS" : "EFF");
    const Icon = isTeam ? Users : (isEmployee ? Star : Medal);
    
    const bgClass = isTeam ? "bg-emerald-500" : (isEmployee ? "bg-amber-500" : "bg-indigo-500");
    const bgSoftClass = isTeam ? "bg-emerald-100" : (isEmployee ? "bg-amber-100" : "bg-indigo-100");
    const textClass = isTeam ? "text-emerald-700" : (isEmployee ? "text-amber-700" : "text-indigo-700");
    const badgeBg = isTeam ? "bg-emerald-500/10" : (isEmployee ? "bg-amber-500/10" : "bg-indigo-500/10");
    const badgeText = isTeam ? "text-emerald-500" : (isEmployee ? "text-amber-500" : "text-indigo-500");

    return (
      <div className="px-5 py-3.5 flex items-center justify-between group hover:bg-muted/5 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {isTeam ? (
              <div className="size-9 rounded-full border border-border flex items-center justify-center bg-emerald-50 text-emerald-600">
                <Users className="size-4" />
              </div>
            ) : (
              <Avatar className="size-9 border border-border">
                <AvatarImage src={champion.avatarUrl || ""} alt={name} />
                <AvatarFallback className={cn("font-bold text-[10px]", bgSoftClass, textClass)}>
                  {name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className={cn("absolute -bottom-1 -right-1 text-white rounded-full p-0.5 border border-background", bgClass)}>
              <Icon className="size-2.5 fill-white" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
              {name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded-[2px]", badgeBg, badgeText)}>
                {title}
              </span>
              {!isTeam && (
                <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-tight truncate">
                  {champion.department}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4 flex flex-col items-end cursor-help" title={isTeam ? "Average Score" : (isEmployee ? "Points" : "Efficiency")}>
          <span className="text-[11px] font-black text-foreground tabular-nums">
            {scoreValue}
          </span>
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{scoreLabel}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border/80 rounded-md overflow-hidden flex flex-col h-[430px] shadow-2xs">
      <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Trophy className="size-3.5 text-amber-500 shrink-0" /> Wall of Fame
            </h2>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              Leaderboard
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Live race standings and previous month top performers.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border/20 flex-1 overflow-y-auto scrollbar-hide">

        {/* Live Leaderboard Section */}
        {(liveEmployee || liveTl || liveTeam) && (
          <>
            <div className="px-5 py-2 bg-muted/5 border-b border-border/10 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Live Leaderboard</span>
            </div>
            {renderItem(liveEmployee, "employee", "Star Employee")}
            {renderItem(liveTl, "leader", "Top Leader")}
            {renderItem(liveTeam, "team", "Top Team")}
          </>
        )}

        {/* Previous Month Section */}
        {(prevEmployee || prevTl || prevTeam) && (
          <>
            <div className="px-5 py-2 bg-muted/5 border-b border-border/10">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Previous Champions</span>
            </div>
            {renderItem(prevEmployee, "employee", "Month's Best")}
            {renderItem(prevTl, "leader", "Month's Leader")}
            {renderItem(prevTeam, "team", "Month's Team")}
          </>
        )}

      </div>
    </div>
  );
}
