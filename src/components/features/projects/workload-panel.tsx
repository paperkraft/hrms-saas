"use client"

import { useState, useEffect, useCallback } from "react"
import { getTeamWorkload } from "@/actions/commitments/core"
import { Users, Zap, AlertTriangle, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberWorkload {
  user: { id: string; name: string | null; designation?: string | null } | null
  workload: {
    activeTasks: number
    committedTasks: number
    estimatedHours: number
    capacityPct: number
    overdueTasks: number
  }
}

interface WorkloadPanelProps {
  memberIds: string[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** When true, shows a soft warning if selected user is at 90%+ capacity */
  showSoftWarning?: boolean
}

// ── Capacity helpers ──────────────────────────────────────────────────────────

function getCapacityLevel(pct: number): "healthy" | "moderate" | "high" | "overloaded" {
  if (pct <= 75)  return "healthy"
  if (pct <= 90)  return "moderate"
  if (pct <= 110) return "high"
  return "overloaded"
}

const CAPACITY_STYLES = {
  healthy:    { bar: "bg-emerald-500", text: "text-emerald-700", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "✅ Healthy" },
  moderate:   { bar: "bg-amber-500",   text: "text-amber-700",   badge: "bg-amber-50 text-amber-700 border-amber-200",     label: "🟡 Moderate" },
  high:       { bar: "bg-orange-500",  text: "text-orange-700",  badge: "bg-orange-50 text-orange-700 border-orange-200",  label: "⚠️ High Load" },
  overloaded: { bar: "bg-rose-500",    text: "text-rose-700",    badge: "bg-rose-50 text-rose-700 border-rose-200",        label: "🔴 Overloaded" }
}

// ── Capacity Bar ──────────────────────────────────────────────────────────────

function CapacityBar({ pct, level }: { pct: number; level: string }) {
  const styles = CAPACITY_STYLES[level as keyof typeof CAPACITY_STYLES] || CAPACITY_STYLES.healthy
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden min-w-[60px]">
        <div
          className={cn("h-full rounded-full transition-all duration-500", styles.bar)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn("text-[9px] font-black shrink-0", styles.text)}>{pct}%</span>
    </div>
  )
}

// ── Member Row ────────────────────────────────────────────────────────────────

function MemberWorkloadRow({
  item,
  isSelected,
  onSelect
}: {
  item: MemberWorkload
  isSelected: boolean
  onSelect?: () => void
}) {
  if (!item.user) return null
  const level = getCapacityLevel(item.workload.capacityPct)
  const styles = CAPACITY_STYLES[level]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-2.5 py-2 rounded-sm border transition-all duration-150 hover:bg-muted/20",
        isSelected
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 bg-white hover:border-primary/20"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
            <p className="text-[11px] font-bold text-foreground truncate max-w-[140px]">{item.user.name}</p>
            <span className={cn("text-[7px] font-black uppercase tracking-widest px-1 py-px rounded-[2px] border shrink-0", styles.badge)}>
              {styles.label}
            </span>
          </div>
          
          <div className="flex items-center flex-wrap gap-2 mt-1 text-[9px] text-muted-foreground/80">
            <span className="flex items-center gap-0.5">
              <Zap className="size-2.5 text-muted-foreground/60" /> {item.workload.activeTasks} active
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="size-2.5 text-muted-foreground/60" /> {item.workload.estimatedHours}h
            </span>
            {item.workload.overdueTasks > 0 && (
              <span className="flex items-center gap-0.5 text-rose-600 font-bold bg-rose-50 px-1 rounded-[2px]">
                <AlertTriangle className="size-2.5" /> {item.workload.overdueTasks} late
              </span>
            )}
          </div>
        </div>

        <div className="w-full sm:w-[130px] shrink-0 mt-1.5 sm:mt-0">
          <CapacityBar pct={item.workload.capacityPct} level={level} />
        </div>
      </div>
    </button>
  )
}

// ── Soft Warning Banner ───────────────────────────────────────────────────────

export function WorkloadSoftWarning({
  userName,
  capacityPct,
  activeTasks,
  overdueTasks,
  onProceed,
  onChooseOther
}: {
  userName: string
  capacityPct: number
  activeTasks: number
  overdueTasks: number
  onProceed: () => void
  onChooseOther: () => void
}) {
  return (
    <div className="rounded-sm border border-orange-200 bg-orange-50 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="size-4 text-orange-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-orange-900">
            {userName}'s workload is at {capacityPct}%
          </p>
          <p className="text-[10px] text-orange-700/80 mt-0.5">
            Active tasks: {activeTasks} · Overdue: {overdueTasks}
          </p>
          <p className="text-[10px] text-orange-700/70 mt-1.5 leading-relaxed">
            You can still assign this task. The employee will be able to accept, raise a workload concern, or request reassignment.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          onClick={onChooseOther}
          className="flex-1 h-8 rounded-sm border border-orange-300 text-orange-800 text-[9px] font-black uppercase tracking-wider hover:bg-orange-100 transition-colors shrink-0"
        >
          Choose Someone Else
        </button>
        <button
          type="button"
          onClick={onProceed}
          className="flex-1 h-8 rounded-sm bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-black uppercase tracking-wider transition-colors shrink-0"
        >
          Assign Anyway
        </button>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function WorkloadPanel({
  memberIds,
  selectedId,
  onSelect,
  showSoftWarning = false
}: WorkloadPanelProps) {
  const [workloads, setWorkloads] = useState<MemberWorkload[]>([])
  const [loading, setLoading] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [warningAcknowledged, setWarningAcknowledged] = useState(false)

  const fetchWorkloads = useCallback(async () => {
    if (memberIds.length === 0) return
    setLoading(true)
    const result = await getTeamWorkload(memberIds)
    if (result.success && result.data) {
      setWorkloads(result.data as MemberWorkload[])
    }
    setLoading(false)
  }, [memberIds.join(",")])

  useEffect(() => { fetchWorkloads() }, [fetchWorkloads])

  // Watch selected member for soft warning
  useEffect(() => {
    if (!showSoftWarning || !selectedId || warningAcknowledged) {
      setShowWarning(false)
      return
    }
    const selected = workloads.find(w => w.user?.id === selectedId)
    if (selected && selected.workload.capacityPct > 90) {
      setShowWarning(true)
    } else {
      setShowWarning(false)
    }
  }, [selectedId, workloads, showSoftWarning, warningAcknowledged])

  // Reset warning when selection changes
  useEffect(() => {
    setWarningAcknowledged(false)
    setShowWarning(false)
  }, [selectedId])

  if (loading) {
    return (
      <div className="rounded-sm border border-border p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading team capacity...
      </div>
    )
  }

  if (workloads.length === 0) return null

  const selectedWorkload = workloads.find(w => w.user?.id === selectedId)
  const selectedLevel = selectedWorkload ? getCapacityLevel(selectedWorkload.workload.capacityPct) : "healthy"

  return (
    <div className="rounded-sm border border-border overflow-hidden">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-border/40 bg-muted/20 flex items-center gap-2">
        <Users className="size-3.5 text-muted-foreground/60" />
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
          Team Capacity
        </p>
        <span className="ml-auto text-[9px] text-muted-foreground/40">
          Standard: 48h / week
        </span>
      </div>

      {/* Soft warning */}
      {showSoftWarning && showWarning && selectedWorkload && selectedWorkload.user && (
        <div className="p-3 border-b border-orange-200">
          <WorkloadSoftWarning
            userName={selectedWorkload.user.name || "This employee"}
            capacityPct={selectedWorkload.workload.capacityPct}
            activeTasks={selectedWorkload.workload.activeTasks}
            overdueTasks={selectedWorkload.workload.overdueTasks}
            onProceed={() => {
              setWarningAcknowledged(true)
              setShowWarning(false)
            }}
            onChooseOther={() => {
              onSelect?.("")
              setShowWarning(false)
            }}
          />
        </div>
      )}

      {/* Member list */}
      <div className="p-2 space-y-1.5 max-h-[240px] overflow-y-auto scrollbar-hide">
        {workloads.map(item => (
          <MemberWorkloadRow
            key={item.user?.id}
            item={item}
            isSelected={selectedId === item.user?.id}
            onSelect={() => {
              if (item.user?.id) onSelect?.(item.user.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}
