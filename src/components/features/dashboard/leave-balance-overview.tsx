"use client";

import { StatCard } from "@/components/ui";
import { Star, LayoutGrid, HeartPulse, FileText } from "lucide-react";

interface LeaveBalanceOverviewProps {
  casual: { remaining: number };
  casualYearly: { taken: number; total: number };
  sickYearly: { taken: number; total: number };
  earned: { remaining: number; total: number };
}

export function LeaveBalanceOverview({ casual, casualYearly, sickYearly, earned }: LeaveBalanceOverviewProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Monthly Pool */}
      <StatCard
        label="Monthly Pool"
        value={`${casual.remaining} days`}
        subValue="Casual & Sick"
        icon={<LayoutGrid className="size-4" />}
        progress={Math.min(100, Math.round((casual.remaining / 2) * 100))}
        progressColor="bg-indigo-500"
      />

      {/* Earned Leaves */}
      <StatCard
        label="Earned Leaves"
        value={`${earned.remaining} days`}
        subValue="Semi-annual cycle"
        icon={<Star className="size-4" />}
        progress={Math.round((earned.remaining / earned.total) * 100)}
        progressColor="bg-blue-500"
      />

      {/* Casual Usage */}
      <StatCard
        label="Casual Usage"
        value={`${casualYearly.taken} days`}
        subValue={`${casualYearly.total - casualYearly.taken} days remaining this year`}
        icon={<FileText className="size-4" />}
        progress={Math.round((casualYearly.taken / casualYearly.total) * 100)}
        progressColor="bg-amber-500"
      />

      {/* Sick Usage */}
      <StatCard
        label="Sick Usage"
        value={`${sickYearly.taken} days`}
        subValue={`${sickYearly.total - sickYearly.taken} days remaining this year`}
        icon={<HeartPulse className="size-4" />}
        progress={Math.round((sickYearly.taken / sickYearly.total) * 100)}
        progressColor="bg-rose-500"
      />
    </div>
  );
}
