"use client";

import React, { useState } from "react";
import {
  Calendar,
  Plus,
  Settings2,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Edit,
  Trash2,
  Umbrella,
  Sun,
  Activity,
  Plane,
  Heart,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  saveLeavePolicy,
  toggleLeavePolicyStatus,
  applyPolicyTemplate,
  LeavePolicyInput,
  PolicyTemplateType,
} from "@/actions/leave/policy-manager";

interface LeavePoliciesClientProps {
  initialPolicies: any[];
}

export function LeavePoliciesClient({ initialPolicies }: LeavePoliciesClientProps) {
  const [policies, setPolicies] = useState<any[]>(initialPolicies);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicyInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const defaultPolicy: LeavePolicyInput = {
    name: "",
    code: "",
    description: "",
    color: "#3b82f6",
    icon: "calendar",
    accrualType: "MONTHLY_ACCRUAL",
    accrualRate: 1.0,
    maxAnnualQuota: 12.0,
    maxCarryForward: 0.0,
    allowEncashment: false,
    allowHalfDay: true,
    allowShortLeave: false,
    probationRestricted: false,
    probationDays: 90,
    minNoticeDaysForAutoApproval: 0,
    requiresApproval: true,
    minConsecutiveDays: 1,
    maxConsecutiveDays: null,
    sandwichRuleEnabled: false,
    customNotificationEmails: [],
    isActive: true,
    sortOrder: policies.length + 1,
  };

  const handleOpenCreate = () => {
    setEditingPolicy({ ...defaultPolicy });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (policy: any) => {
    setEditingPolicy({
      id: policy.id,
      name: policy.name,
      code: policy.code,
      description: policy.description || "",
      color: policy.color || "#3b82f6",
      icon: policy.icon || "calendar",
      accrualType: policy.accrualType,
      accrualRate: Number(policy.accrualRate),
      maxAnnualQuota: Number(policy.maxAnnualQuota),
      maxCarryForward: Number(policy.maxCarryForward),
      allowEncashment: Boolean(policy.allowEncashment),
      allowHalfDay: Boolean(policy.allowHalfDay),
      allowShortLeave: Boolean(policy.allowShortLeave),
      probationRestricted: Boolean(policy.probationRestricted),
      probationDays: Number(policy.probationDays || 90),
      minNoticeDaysForAutoApproval: Number(policy.minNoticeDaysForAutoApproval || 0),
      requiresApproval: Boolean(policy.requiresApproval),
      minConsecutiveDays: Number(policy.minConsecutiveDays || 1),
      maxConsecutiveDays: policy.maxConsecutiveDays ? Number(policy.maxConsecutiveDays) : null,
      sandwichRuleEnabled: Boolean(policy.sandwichRuleEnabled),
      customNotificationEmails: policy.customNotificationEmails || [],
      isActive: Boolean(policy.isActive),
      sortOrder: Number(policy.sortOrder || 0),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;

    if (!editingPolicy.name.trim() || !editingPolicy.code.trim()) {
      toast.error("Policy name and code are required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveLeavePolicy(editingPolicy);
      if (res.success && res.policy) {
        toast.success("Leave policy saved successfully!");
        if (editingPolicy.id) {
          setPolicies((prev) =>
            prev.map((p) => (p.id === res.policy.id ? res.policy : p))
          );
        } else {
          setPolicies((prev) => [...prev, res.policy]);
        }
        setIsModalOpen(false);
      } else {
        toast.error(res.error || "Failed to save policy.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (policy: any) => {
    const newStatus = !policy.isActive;
    try {
      const res = await toggleLeavePolicyStatus(policy.id, newStatus);
      if (res.success) {
        setPolicies((prev) =>
          prev.map((p) => (p.id === policy.id ? { ...p, isActive: newStatus } : p))
        );
        toast.success(`Policy ${newStatus ? "enabled" : "disabled"}.`);
      } else {
        toast.error(res.error || "Failed to toggle status.");
      }
    } catch (err: any) {
      toast.error("Failed to toggle status.");
    }
  };

  const handleApplyTemplate = async (template: PolicyTemplateType) => {
    setIsSaving(true);
    try {
      const res = await applyPolicyTemplate(template);
      if (res.success) {
        toast.success(res.message);
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to apply template.");
      }
    } catch (err: any) {
      toast.error("Failed to apply template.");
    } finally {
      setIsSaving(false);
      setIsTemplateModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/40 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Configured Leave Policies
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define custom leave types, accrual rates, probation restrictions, and auto-approval workflows for your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Apply Template
          </Button>
          <Button onClick={handleOpenCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Policy
          </Button>
        </div>
      </div>

      {/* Policy Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {policies.map((policy) => {
          return (
            <div
              key={policy.id}
              className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 ${
                policy.isActive
                  ? "bg-card border-border/70 hover:border-primary/40 shadow-sm"
                  : "bg-muted/30 border-dashed border-border opacity-70"
              }`}
            >
              <div>
                {/* Header Tag */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: policy.color || "#3b82f6" }}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-base leading-tight">
                        {policy.name}
                      </h3>
                      <span className="text-[11px] font-mono uppercase text-muted-foreground tracking-wider">
                        {policy.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleOpenEdit(policy)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {policy.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                    {policy.description}
                  </p>
                )}

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 text-xs mb-4">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Accrual Cadence</span>
                    <span className="font-medium text-foreground">
                      {policy.accrualType === "MONTHLY_ACCRUAL"
                        ? `${policy.accrualRate}d / Month`
                        : policy.accrualType === "ANNUAL_UPFRONT"
                        ? `${policy.maxAnnualQuota}d / Year`
                        : policy.accrualType === "SEMI_ANNUAL_CYCLE"
                        ? `${policy.accrualRate}d / 6 Months`
                        : "On Demand"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Annual Cap</span>
                    <span className="font-medium text-foreground">
                      {policy.maxAnnualQuota} Days
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Carry Forward</span>
                    <span className="font-medium text-foreground">
                      {policy.maxCarryForward > 0 ? `Max ${policy.maxCarryForward}d` : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Auto Approval</span>
                    <span className="font-medium text-foreground">
                      {policy.minNoticeDaysForAutoApproval > 0
                        ? `Notice ≥ ${policy.minNoticeDaysForAutoApproval}d`
                        : "Manual / Admin"}
                    </span>
                  </div>
                </div>

                {/* Rule Badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {policy.allowHalfDay && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      Half-Day Allowed
                    </span>
                  )}
                  {policy.allowShortLeave && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      Short-Leave Allowed
                    </span>
                  )}
                  {policy.probationRestricted && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <ShieldAlert className="w-2.5 h-2.5" />
                      {policy.probationDays}d Probation Lock
                    </span>
                  )}
                  {policy.allowEncashment && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Encashable
                    </span>
                  )}
                  {policy.minConsecutiveDays > 1 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400">
                      Min {policy.minConsecutiveDays} consecutive days
                    </span>
                  )}
                  {policy.sandwichRuleEnabled && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      Sandwich Rule
                    </span>
                  )}
                </div>
              </div>

              {/* Status Toggle Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      policy.isActive ? "bg-emerald-500" : "bg-muted-foreground"
                    }`}
                  />
                  {policy.isActive ? "Active Policy" : "Inactive"}
                </span>

                <Switch
                  checked={policy.isActive}
                  onCheckedChange={() => handleToggleActive(policy)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Policy Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy?.id ? "Edit Leave Policy" : "Create New Leave Policy"}
            </DialogTitle>
            <DialogDescription>
              Configure the accrual calculations, quota rules, and validation constraints for this leave category.
            </DialogDescription>
          </DialogHeader>

          {editingPolicy && (
            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Policy Name *</Label>
                  <Input
                    value={editingPolicy.name}
                    onChange={(e) =>
                      setEditingPolicy({ ...editingPolicy, name: e.target.value })
                    }
                    placeholder="e.g. Casual Leave"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Code Identifier *</Label>
                  <Input
                    value={editingPolicy.code}
                    onChange={(e) =>
                      setEditingPolicy({ ...editingPolicy, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. CASUAL, SICK, MATERNITY"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={editingPolicy.description || ""}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, description: e.target.value })
                  }
                  placeholder="Explain policy guidelines, eligibility, or documentation requirements..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Accrual Cadence</Label>
                  <Select
                    value={editingPolicy.accrualType}
                    onValueChange={(val: any) =>
                      setEditingPolicy({ ...editingPolicy, accrualType: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY_ACCRUAL">Monthly Accrual</SelectItem>
                      <SelectItem value="ANNUAL_UPFRONT">Annual Upfront</SelectItem>
                      <SelectItem value="SEMI_ANNUAL_CYCLE">Semi-Annual Cycle</SelectItem>
                      <SelectItem value="ON_DEMAND">On-Demand / Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Accrual Rate (Days)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editingPolicy.accrualRate}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        accrualRate: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Max Annual Quota</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editingPolicy.maxAnnualQuota}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        maxAnnualQuota: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Max Carry Forward</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editingPolicy.maxCarryForward}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        maxCarryForward: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Auto-Approval Notice</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0 = None"
                    value={editingPolicy.minNoticeDaysForAutoApproval}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        minNoticeDaysForAutoApproval: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Min Consecutive Days</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingPolicy.minConsecutiveDays}
                    onChange={(e) =>
                      setEditingPolicy({
                        ...editingPolicy,
                        minConsecutiveDays: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Allow Half-Day</Label>
                  <Switch
                    checked={editingPolicy.allowHalfDay}
                    onCheckedChange={(val) =>
                      setEditingPolicy({ ...editingPolicy, allowHalfDay: val })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Allow Short Leave (2h)</Label>
                  <Switch
                    checked={editingPolicy.allowShortLeave}
                    onCheckedChange={(val) =>
                      setEditingPolicy({ ...editingPolicy, allowShortLeave: val })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Allow Encashment</Label>
                  <Switch
                    checked={editingPolicy.allowEncashment}
                    onCheckedChange={(val) =>
                      setEditingPolicy({ ...editingPolicy, allowEncashment: val })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="cursor-pointer">Sandwich Rule (Weekends)</Label>
                  <Switch
                    checked={editingPolicy.sandwichRuleEnabled}
                    onCheckedChange={(val) =>
                      setEditingPolicy({ ...editingPolicy, sandwichRuleEnabled: val })
                    }
                  />
                </div>

                <div className="flex items-center justify-between col-span-2 pt-2 border-t border-border/40">
                  <div>
                    <Label className="cursor-pointer">Lock during Probation</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Restricts employees in their initial probation period.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingPolicy.probationRestricted && (
                      <Input
                        type="number"
                        className="w-20 h-8 text-xs"
                        value={editingPolicy.probationDays}
                        onChange={(e) =>
                          setEditingPolicy({
                            ...editingPolicy,
                            probationDays: parseInt(e.target.value) || 90,
                          })
                        }
                      />
                    )}
                    <Switch
                      checked={editingPolicy.probationRestricted}
                      onCheckedChange={(val) =>
                        setEditingPolicy({ ...editingPolicy, probationRestricted: val })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Custom Notification Emails */}
              <div className="space-y-1.5">
                <Label>Additional Email Recipients for this Policy (Optional)</Label>
                <Input
                  value={(editingPolicy.customNotificationEmails || []).join(", ")}
                  onChange={(e) => {
                    const emails = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setEditingPolicy({
                      ...editingPolicy,
                      customNotificationEmails: emails,
                    });
                  }}
                  placeholder="e.g. director@company.com, auditor@company.com (comma separated)"
                />
                <p className="text-[11px] text-muted-foreground">
                  These emails will receive an instant notification whenever an employee applies for this specific leave policy.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Policy"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Apply Leave Policy Template
            </DialogTitle>
            <DialogDescription>
              Quickly provision standard industry policy structures for your tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div
              onClick={() => handleApplyTemplate("CORPORATE_STANDARD")}
              className="p-4 rounded-xl border border-border hover:border-primary cursor-pointer hover:bg-primary/5 transition-all group"
            >
              <h4 className="font-semibold text-foreground group-hover:text-primary">
                Corporate Standard (CL + SL + Earned Leave)
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                • 12 Casual Leaves (1.0/mo) • 7 Sick Leaves (Annual) • 15 Earned Leaves (Annual Upfront, min 3 consecutive days) • Unpaid LWP
              </p>
            </div>

            <div
              onClick={() => handleApplyTemplate("SIGMA_LEGACY")}
              className="p-4 rounded-xl border border-border hover:border-primary cursor-pointer hover:bg-primary/5 transition-all group"
            >
              <h4 className="font-semibold text-foreground group-hover:text-primary">
                Monthly Accrual + Semi-Annual Block (Sigma Standard)
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                • Policy 1: Monthly 2.0d Casual/Medical with 1.0d carry-forward & encashment • Policy 2: Semi-Annual 3.0d block leave • Unpaid
              </p>
            </div>

            <div
              onClick={() => handleApplyTemplate("STARTUP_PTO")}
              className="p-4 rounded-xl border border-border hover:border-primary cursor-pointer hover:bg-primary/5 transition-all group"
            >
              <h4 className="font-semibold text-foreground group-hover:text-primary">
                Startup & Tech Flexible PTO
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                • 18 Days Combined Paid Time Off (PTO) upfront • 4 Wellness / Mental Health Days • Auto-approved with 3+ days notice
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTemplateModalOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
