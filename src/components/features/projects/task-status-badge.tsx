import { cn } from "@/lib/utils"

export function TaskStatusBadge({ status, className }: { status: string, className?: string }) {
  switch (status) {
    case "COMPLETED":
      return (
        <div className={cn("text-emerald-600 font-bold", className)}>
          <span className="text-[10px] uppercase tracking-widest">Done</span>
        </div>
      )
    case "IN_PROGRESS":
      return (
        <div className={cn("text-blue-600 font-bold", className)}>
          <span className="text-[10px] uppercase tracking-widest">Working</span>
        </div>
      )
    case "IN_REVIEW":
      return (
        <div className={cn("text-amber-500 font-bold", className)}>
          <span className="text-[10px] uppercase tracking-widest">In Review</span>
        </div>
      )
    case "ON_HOLD":
      return (
        <div className={cn("text-slate-400 font-bold", className)}>
          <span className="text-[10px] uppercase tracking-widest">On Hold</span>
        </div>
      )
    case "TODO":
    default:
      return (
        <div className={cn("text-slate-400 font-bold", className)}>
          <span className="text-[10px] uppercase tracking-widest">To Do</span>
        </div>
      )
  }
}
