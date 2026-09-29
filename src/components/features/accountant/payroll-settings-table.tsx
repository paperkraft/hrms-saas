"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Edit, Save, IndianRupee, Calculator, Download, Eye, X, UserCheck, UserX, Users } from "lucide-react";
import { updateSalaryStructure } from "@/actions/payroll/structure";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { generateCTC } from "@/lib/pdf/generate-ctc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

export function PayrollSettingsTable({ data, reportData, workingDaysInMonth = 26, currentMonth }: { data: any[], reportData?: any[], workingDaysInMonth?: number, currentMonth?: number }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE_RESIGNED" | "ALL">("ACTIVE");
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [dialogMode, setDialogMode] = useState<"CTC" | "MONTHLY" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const router = useRouter();

  const activeCount = useMemo(() => data.filter(r => !r.status || r.status === "ACTIVE").length, [data]);
  const inactiveCount = useMemo(() => data.filter(r => r.status && r.status !== "ACTIVE").length, [data]);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return data.filter(row => {
      const matchesSearch = !searchTerm ||
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        (row.employeeCode && row.employeeCode.toLowerCase().includes(term)) ||
        (row.department?.name && row.department.name.toLowerCase().includes(term));

      const isUserActive = !row.status || row.status === "ACTIVE";
      const matchesStatus = statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
          ? isUserActive
          : !isUserActive;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);

  const startEditing = (row: any, mode: "CTC" | "MONTHLY") => {
    setEditingRow(row);
    setDialogMode(mode);
    setIsDialogOpen(true);
    const existing = row.salaryStructure || {};
    const reportRow = reportData?.find((r: any) => r.id === row.id);

    setFormData({
      grossSalary: existing.grossSalary > 0 ? existing.grossSalary : (existing.basic ?? 0),
      annualBonus: existing.annualBonus ?? 0,
      basic: existing.basic ?? 0,
      hra: existing.hra ?? 0,
      conveyance: existing.conveyance ?? 0,
      consolidated: existing.consolidated ?? 0,
      medical: existing.medical ?? 0,
      tds: existing.tds ?? 0,
      providentFund: existing.providentFund ?? 0,
      esic: existing.esic ?? 0,
      allowance: existing.allowance > 0 ? existing.allowance : ((reportRow?.allowanceDays ?? 0) * 350),
      unpaidLeaves: (reportRow?.lwpDays ?? 0) + (reportRow?.missingDays ?? 0),
      encashableDays: reportRow?.encashableDays ?? 0,
      hasChildrenAllowance: (existing.childrenEducation || existing.childrenHostel) > 0,
      extraDaysWorked: reportRow?.extraDaysWorked ?? 0,
      overtimeHours: reportRow?.overtimeHours ?? 0,
      autoAllowanceDays: reportRow?.allowanceDays ?? 0,
      bankName: existing.bankName ?? "",
      accountNumber: existing.accountNumber ?? "",
      pfAccountNumber: existing.pfAccountNumber ?? "",
      panNumber: existing.panNumber ?? "",
      employeeCode: row.employeeCode ?? "",
      gender: row.gender ?? "MALE",
      excludeFromPayroll: existing.excludeFromPayroll ?? false
    });
  };

  const cancelEditing = () => {
    setIsDialogOpen(false);
  };

  const saveEditing = async () => {
    if (!editingRow) return;
    try {
      // We explicitly exclude paidLeaves as well in case it's leftover in the client's React state
      const { unpaidLeaves, paidLeaves, encashableDays, extraDaysWorked, overtimeHours, autoAllowanceDays, hasChildrenAllowance, ...restFormData } = formData;
      const autoAllowanceCalc = Number(formData.autoAllowanceDays || 0) * 350;
      const editedAllowance = Number(formData.allowance || 0);

      const formattedData = {
        ...restFormData,
        grossSalary: Number(formData.grossSalary || 0),
        annualBonus: Number(formData.annualBonus || 0),
        basic: Number(formData.basic || 0),
        providentFund: Number(formData.providentFund || 0),
        esic: Number(formData.esic || 0),
        allowance: editedAllowance === autoAllowanceCalc ? 0 : editedAllowance,

        // Save the manual or auto-calculated values
        hra: Number(formData.hra || 0),
        conveyance: Number(formData.conveyance || 0),
        consolidated: Number(formData.consolidated || 0),
        medical: Number(formData.medical || 0),
        childrenEducation: formData.hasChildrenAllowance ? 1 : 0, // Saved as a flag > 0
        childrenHostel: formData.hasChildrenAllowance ? 1 : 0, // Saved as a flag > 0
        tds: 0,
        excludeFromPayroll: !!formData.excludeFromPayroll,
      };

      const res = await updateSalaryStructure(editingRow.id, formattedData);
      if (res.success) {
        toast.success("Salary structure updated");
        setIsDialogOpen(false);
        router.refresh();
      } else {
        toast.error("Failed to update");
      }
    } catch (e) {
      toast.error("An error occurred");
    }
  };

  const handleDownloadCTC = async () => {
    try {
      const doc = await generateCTC(formData, editingRow?.name || "Employee", formData.employeeCode || editingRow?.employeeCode || "N/A", editingRow?.designation || "N/A");
      doc.save(`${editingRow?.name || 'Employee'}_CTC.pdf`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate CTC");
    }
  };

  const handlePreviewCTC = async () => {
    try {
      const doc = await generateCTC(formData, editingRow?.name || "Employee", formData.employeeCode || editingRow?.employeeCode || "N/A", editingRow?.designation || "N/A");
      window.open(doc.output("bloburl"), "_blank");
    } catch (error) {
      console.error(error);
      toast.error("Failed to preview CTC");
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev: any) => {
      const next = { ...prev, [field]: value };

      if (field === "grossSalary" || field === "hasChildrenAllowance") {
        const grossSalary = Number(next.grossSalary) || 0;
        const basicAmt = Math.round(grossSalary * 0.50);
        const hraAmt = Math.round(basicAmt * 0.50);
        const childEduAmt = next.hasChildrenAllowance ? Math.round(grossSalary * 0.05) : 0;
        const childHostelAmt = next.hasChildrenAllowance ? Math.round(grossSalary * 0.05) : 0;
        const remPool = Math.max(0, grossSalary - (basicAmt + hraAmt) - childEduAmt - childHostelAmt);
        const convAmt = Math.round(remPool * 0.40);
        const consAmt = Math.round(remPool * 0.40);
        const medAmt = Math.round(remPool) - convAmt - consAmt;

        const pfAmt = Math.round(Math.min(basicAmt, 15000) * 0.12);
        const esicAmtCalc = basicAmt <= 21000 ? Math.round(basicAmt * 0.0325) : 0;

        return {
          ...next,
          basic: basicAmt,
          hra: hraAmt,
          conveyance: convAmt,
          consolidated: consAmt,
          medical: medAmt,
          providentFund: pfAmt,
          esic: esicAmtCalc,
        };
      }

      return next;
    });
  };

  const getGross = () => {
    const grossSalary = Number(formData.grossSalary) || 0;

    // Calculate expected payable days (Working Days - Unpaid Leaves)
    const unpaid = Number(formData.unpaidLeaves) || 0;
    const payableDays = Math.max(0, workingDaysInMonth - unpaid);

    // Prorate Gross Salary
    const derivedGross = Math.round((grossSalary / workingDaysInMonth) * payableDays);

    const basic = Math.round(derivedGross * 0.50);
    const hra = Math.round(basic * 0.50);

    // Dynamically deduct children allowances based on Derived Gross (5% each if applicable)
    const childrenEducation = formData.hasChildrenAllowance ? Math.round(derivedGross * 0.05) : 0;
    const childrenHostel = formData.hasChildrenAllowance ? Math.round(derivedGross * 0.05) : 0;

    // Remaining pool for Conveyance, Consolidated, and Medical
    const totalRemaining = Math.max(0, derivedGross - (basic + hra) - childrenEducation - childrenHostel);

    const conv = Math.round(totalRemaining * 0.40);
    const cons = Math.round(totalRemaining * 0.40);
    const med = Math.round(totalRemaining) - conv - cons;

    const total = basic + hra + conv + cons + med + childrenEducation + childrenHostel;

    const encash = Number(formData.encashableDays) || 0;
    const extra = Number(formData.extraDaysWorked) || 0;
    const autoReimbursement = Math.round((grossSalary / workingDaysInMonth) * encash) + Math.round((grossSalary / workingDaysInMonth) * extra);

    const overtimeHours = Number(formData.overtimeHours) || 0;
    const overtimePay = Math.round(((grossSalary / workingDaysInMonth) / 8) * overtimeHours);

    const autoAllowanceDays = Number(formData.autoAllowanceDays) || 0;
    const calculatedAllowance = Math.round(autoAllowanceDays * 350);
    const manualAllowance = Number(formData.allowance) || 0;
    const allowance = manualAllowance > 0 ? manualAllowance : calculatedAllowance;

    // Deductions
    const pf = Math.round(Math.min(basic, 15000) * 0.12);

    const esicApplicable = Number(formData.esic) > 0;
    const esic = (esicApplicable && basic <= 21000) ? Math.round(basic * 0.0075) : 0;

    const isFemale = formData.gender === "FEMALE";
    const ptAmount = currentMonth === 2 ? 300 : 200;
    const pt = isFemale ? (grossSalary >= 26000 ? ptAmount : 0) : (grossSalary >= 10000 ? ptAmount : 0);

    const subtotalAdditions = total + autoReimbursement + overtimePay + allowance;
    const subtotalDeductions = pf + esic + pt;
    const netSalary = Math.max(0, subtotalAdditions - subtotalDeductions);

    return {
      grossSalary, derivedGross, basic, hra, conv, cons, med, childrenEducation, childrenHostel, total,
      autoReimbursement, overtimePay, allowance, pf, esic, pt, subtotalAdditions, subtotalDeductions, netSalary
    };
  };

  const preview = getGross();

  return (
    <div className="space-y-0">
      <div className="px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/20 border-b border-border/70">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Search active or inactive staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8 border-border/70 focus:ring-primary/20 transition-all rounded-md text-xs bg-background"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-md transition-colors"
              >
                <X className="size-3 text-muted-foreground/50" />
              </button>
            )}
          </div>

          {/* Status View Toggle Pills */}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-md border border-border/70 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                statusFilter === "ACTIVE"
                  ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <UserCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span>Active</span>
              <span className="text-[10px] font-mono opacity-80">({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("INACTIVE_RESIGNED")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                statusFilter === "INACTIVE_RESIGNED"
                  ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <UserX className="size-3 text-amber-500" />
              <span>Deactivated / Resigned</span>
              {inactiveCount > 0 && (
                <span className="text-[10px] font-mono opacity-80">({inactiveCount})</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                statusFilter === "ALL"
                  ? "bg-card text-foreground font-bold shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Users className="size-3 text-primary" />
              <span>All</span>
              <span className="text-[10px] font-mono opacity-80">({data.length})</span>
            </button>
          </div>
        </div>

        <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-md border border-border/60 bg-background shrink-0 hidden md:inline-block">
          {filteredData.length} Shown
        </span>
      </div>

      <Table containerClassName="flex-1 max-h-[60vh]" className="border-collapse min-w-max">
        <TableHeader className="sticky top-0 z-30 shadow-xs [&_tr]:border-b-0 bg-muted">
          <TableRow className="bg-muted hover:bg-muted border-b border-border/70">
            <TableHead className="py-3.5 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted">Employee</TableHead>
            <TableHead className="py-3.5 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right bg-muted">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/40">
          {filteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="py-12 text-center text-xs text-muted-foreground font-medium">
                No employees found
              </TableCell>
            </TableRow>
          ) : (
            filteredData.map((row) => {
              const isInactive = row.status && row.status !== "ACTIVE";
              return (
                <TableRow key={row.id} className={cn("hover:bg-muted/30 transition-colors", isInactive && "bg-muted/10 opacity-85")}>
                  <TableCell className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <Avatar className={cn("size-8 rounded-full shrink-0", isInactive && "grayscale opacity-75")}>
                        {row.avatarUrl && (
                          <AvatarImage src={row.avatarUrl} alt={row.name} className="object-cover rounded-full" />
                        )}
                        <AvatarFallback className="bg-muted text-muted-foreground font-bold text-[9px] group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center size-full rounded-full">
                          {getInitials(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("font-bold text-[11px] truncate max-w-35 leading-tight", isInactive ? "text-muted-foreground" : "text-foreground")} title={row.name}>
                            {row.name}
                          </span>
                          {isInactive && (
                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-tight shrink-0">
                              {row.status}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground truncate">{row.designation || row.role || 'Employee'}</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="py-2 px-5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-semibold rounded-md border-border/80 hover:bg-muted/60 cursor-pointer" onClick={() => startEditing(row, "CTC")}>
                        <Edit className="size-3.5 mr-1.5 text-primary" /> CTC Config
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs font-semibold rounded-md border-border/80 hover:bg-muted/60 cursor-pointer" onClick={() => startEditing(row, "MONTHLY")}>
                        <Calculator className="size-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> Monthly Preview
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto gap-0">
          <DialogHeader>
            <DialogTitle>{dialogMode === "CTC" ? "Configure CTC Structure" : "Monthly Payroll Preview & Adjustments"}</DialogTitle>
            <DialogDescription className="sr-only">Adjust salary configuration parameters for {editingRow?.name}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Configuring for: <span className="text-foreground font-bold">{editingRow?.name}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inputs */}
              <div className="space-y-2">
                {dialogMode === "CTC" && (
                  <>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-sm">Employee Details</h4>

                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">Employee Code</Label>
                      <Input className="col-span-2 h-8 text-xs" value={formData.employeeCode ?? ""} onChange={e => handleChange("employeeCode", e.target.value)} placeholder="e.g. EMP-001" />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">Gender (For PT)</Label>
                      <Select value={formData.gender ?? "MALE"} onValueChange={value => handleChange("gender", value)}>
                        <SelectTrigger className="col-span-2 h-8 text-xs w-full">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">Bank Name</Label>
                      <Input className="col-span-2 h-8 text-xs" value={formData.bankName ?? ""} onChange={e => handleChange("bankName", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">Account No.</Label>
                      <Input className="col-span-2 h-8 text-xs" value={formData.accountNumber ?? ""} onChange={e => handleChange("accountNumber", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">PAN Number</Label>
                      <Input className="col-span-2 h-8 text-xs" value={formData.panNumber ?? ""} onChange={e => handleChange("panNumber", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">PF Number</Label>
                      <Input className="col-span-2 h-8 text-xs" value={formData.pfAccountNumber ?? ""} onChange={e => handleChange("pfAccountNumber", e.target.value)} />
                    </div>

                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1.5 rounded-sm mt-4">Base Salary</h4>

                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs font-bold text-primary">Gross Salary</Label>
                      <Input type="number" min="0" className="col-span-2 h-8 border-primary/50 bg-primary/5" value={formData.grossSalary ?? ""} onChange={e => handleChange("grossSalary", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">Annual Bonus</Label>
                      <Input type="number" min="0" className="col-span-2 h-8 text-xs" value={formData.annualBonus ?? ""} onChange={e => handleChange("annualBonus", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">Provident Fund</Label>
                      <Input type="number" min="0" className="col-span-2 h-8 text-xs" value={formData.providentFund ?? ""} onChange={e => handleChange("providentFund", e.target.value)} placeholder="Auto-calculated (12% of Basic)" />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs">ESIC (Employer)</Label>
                      <Input type="number" min="0" className="col-span-2 h-8 text-xs" value={formData.esic ?? ""} onChange={e => handleChange("esic", e.target.value)} placeholder="Auto-calculated (3.25% of Gross)" />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!formData.hasChildrenAllowance}
                        onChange={e => handleChange("hasChildrenAllowance", e.target.checked)}
                        className="rounded border-border bg-card size-4"
                      />
                      <span className="text-[11px] text-muted-foreground">Apply Child Education & Hostel Exemption (5% each)</span>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/40">
                      <input
                        type="checkbox"
                        checked={!!formData.excludeFromPayroll}
                        onChange={e => handleChange("excludeFromPayroll", e.target.checked)}
                        className="rounded border-border bg-card size-4"
                      />
                      <span className="text-[11px] font-bold text-rose-500">Exclude from Payroll Generation (e.g. Probation Users)</span>
                    </div>
                  </>
                )}

                {dialogMode === "MONTHLY" && (
                  <>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-sm">Current Month (For Preview)</h4>

                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs col-span-2">Unpaid Leaves</Label>
                      <Input type="number" min="0" step="0.5" className="h-8" value={formData.unpaidLeaves ?? ""} onChange={e => handleChange("unpaidLeaves", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs col-span-2">Encash Days</Label>
                      <Input type="number" min="0" step="0.5" className="h-8" value={formData.encashableDays ?? ""} onChange={e => handleChange("encashableDays", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs col-span-2">Extra Worked</Label>
                      <Input type="number" min="0" step="0.5" className="h-8" value={formData.extraDaysWorked ?? ""} onChange={e => handleChange("extraDaysWorked", e.target.value)} disabled />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs col-span-2">Overtime (Hrs)</Label>
                      <Input type="number" min="0" step="0.5" className="h-8" value={formData.overtimeHours ?? ""} onChange={e => handleChange("overtimeHours", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-right text-xs col-span-2">Allowance (Days)</Label>
                      <Input type="number" min="0" step="0.5" className="h-8" value={formData.autoAllowanceDays ?? ""} onChange={e => handleChange("autoAllowanceDays", e.target.value)} />
                    </div>



                  </>
                )}
              </div>

              {/* Preview */}
              <div className="space-y-4">
                {dialogMode === "CTC" && (
                  <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-primary">CTC Structure</h4>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handlePreviewCTC}>
                          <Eye className="size-3 mr-1" /> Preview
                        </Button>
                        <Button variant="outline" size="icon" className="size-6 h-6 w-6" onClick={handleDownloadCTC}>
                          <Download className="size-3 text-primary" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Basic (50%)</span>
                        <span><IndianRupee className="inline size-3" /> {Number(formData.basic || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">HRA (50% of Basic)</span>
                        <span><IndianRupee className="inline size-3" /> {Number(formData.hra || 0).toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conveyance (10%)</span>
                        <span><IndianRupee className="inline size-3" /> {Number(formData.conveyance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Consolidated (~10%)</span>
                        <span><IndianRupee className="inline size-3" /> {Number(formData.consolidated || 0).toLocaleString('en-IN')}</span>
                      </div>
                      {formData.hasChildrenAllowance && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Child Education (5%)</span>
                            <span><IndianRupee className="inline size-3" /> {Math.round((Number(formData.grossSalary) || 0) * 0.05).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Child Hostel (5%)</span>
                            <span><IndianRupee className="inline size-3" /> {Math.round((Number(formData.grossSalary) || 0) * 0.05).toLocaleString('en-IN')}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Medical (~5%)</span>
                        <span><IndianRupee className="inline size-3" /> {Number(formData.medical || 0).toLocaleString('en-IN')}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provident Fund (Employer - 12%)</span>
                        <span><IndianRupee className="inline size-3" /> {Number(formData.providentFund || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ESIC (Employer - 3.25%)</span>
                        <span><IndianRupee className="inline size-3" /> {Number(formData.esic || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex justify-between font-bold text-primary">
                        <span>Total Monthly CTC</span>
                        <span><IndianRupee className="inline size-3" /> {(Number(formData.grossSalary || 0) + Number(formData.providentFund || 0) + Number(formData.esic || 0)).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {dialogMode === "MONTHLY" && (
                  <div className="bg-muted/20 p-4 rounded-md border">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Live Formula Preview</h4>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-muted-foreground pb-1">
                        <span>Working Days (Base)</span>
                        <span>{workingDaysInMonth}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground pb-1">
                        <span>Deduction (Unpaid/Missing)</span>
                        <span>- {formData.unpaidLeaves || 0}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground pb-1">
                        <span>Extra Days Worked</span>
                        <span>+ {formData.extraDaysWorked || 0}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground pb-2 border-b">
                        <span>Reimbursement (Encash)</span>
                        <span>+ {formData.encashableDays || 0}</span>
                      </div>
                      <div className="flex justify-between font-bold text-primary pb-2 border-b mt-2">
                        <span>Derived Gross (Gross / {workingDaysInMonth} * {Math.max(0, workingDaysInMonth - (Number(formData.unpaidLeaves) || 0))})</span>
                        <span><IndianRupee className="inline size-3" /> {preview.derivedGross.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-muted-foreground">Basic (50%)</span>
                        <span><IndianRupee className="inline size-3" /> {preview.basic.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">HRA (50% of Basic)</span>
                        <span><IndianRupee className="inline size-3" /> {preview.hra.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conveyance (10%)</span>
                        <span><IndianRupee className="inline size-3" /> {preview.conv.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Consolidated (~10%)</span>
                        <span><IndianRupee className="inline size-3" /> {preview.cons.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Medical (~5%)</span>
                        <span><IndianRupee className="inline size-3" /> {preview.med.toLocaleString('en-IN')}</span>
                      </div>
                      {preview.childrenEducation > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Child Education</span>
                          <span><IndianRupee className="inline size-3" /> {preview.childrenEducation.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {preview.childrenHostel > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Child Hostel</span>
                          <span><IndianRupee className="inline size-3" /> {preview.childrenHostel.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                        <span>Total Derived Gross</span>
                        <span><IndianRupee className="inline size-3" /> {preview.total.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 space-y-2">
                        {preview.autoReimbursement > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reimbursement ({formData.encashableDays || 0} encash + {formData.extraDaysWorked || 0} extra)</span>
                            <span><IndianRupee className="inline size-3" /> {preview.autoReimbursement.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {preview.overtimePay > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Overtime ({formData.overtimeHours || 0} hrs)</span>
                            <span><IndianRupee className="inline size-3" /> {preview.overtimePay.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {preview.allowance > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Allowance</span>
                            <span><IndianRupee className="inline size-3" /> {preview.allowance.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
                      <div className="border-t pt-2 mt-2 space-y-2 text-rose-600/90 font-medium">
                        {preview.pf > 0 && (
                          <div className="flex justify-between">
                            <span>Provident Fund</span>
                            <span><IndianRupee className="inline size-3" /> {preview.pf.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {preview.esic > 0 && (
                          <div className="flex justify-between">
                            <span>ESIC</span>
                            <span><IndianRupee className="inline size-3" /> {preview.esic.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {preview.pt > 0 && (
                          <div className="flex justify-between">
                            <span>Professional Tax (PT)</span>
                            <span><IndianRupee className="inline size-3" /> {preview.pt.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>

                      {preview.subtotalDeductions > 0 && (
                        <div className="pt-2 mt-2 border-t flex justify-between font-bold text-rose-600">
                          <span>Total Deductions</span>
                          <span><IndianRupee className="inline size-3" /> {preview.subtotalDeductions.toLocaleString('en-IN')}</span>
                        </div>
                      )}

                      <div className="pt-3 mt-3 border-t flex justify-between font-black text-sm text-foreground">
                        <span>Net Payable</span>
                        <span><IndianRupee className="inline size-3.5" /> {preview.netSalary.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelEditing}>Cancel</Button>
            <Button onClick={saveEditing}>
              <Save className="size-4 mr-2" /> Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
