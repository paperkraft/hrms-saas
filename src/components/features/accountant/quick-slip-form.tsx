"use client";

import { useState } from "react";
import { generateSalarySlip } from "@/lib/pdf/generate-salary-slip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, Calculator, Download, Eye } from "lucide-react";
import { toast } from "sonner";

export function QuickSlipForm({ employees, currentMonthName, currentYear }: { employees: any[], currentMonthName: string, currentYear: number }) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [cms, setCms] = useState<string>("");
  const [paidDays, setPaidDays] = useState<string>("15");
  const [unpaidDays, setUnpaidDays] = useState<string>("0");
  const [encashDays, setEncashDays] = useState<string>("0");
  const [allowanceDays, setAllowanceDays] = useState<string>("0");
  const [advance, setAdvance] = useState<string>("0");
  const [overtimeHrs, setOvertimeHrs] = useState<string>("0");
  const [bonus, setBonus] = useState<string>("0");
  const [workingDaysInMonth, setWorkingDaysInMonth] = useState<string>("26");

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  const handleEmployeeSelect = (val: string) => {
    setSelectedEmpId(val);
    const emp = employees.find(e => e.id === val);
    if (emp?.salaryStructure?.grossSalary > 0) {
      setCms(emp.salaryStructure.grossSalary.toString());
    } else if (emp?.salaryStructure?.basic) {
      setCms(emp.salaryStructure.basic.toString());
    } else {
      setCms("");
    }
    setBonus(emp?.salaryStructure?.annualBonus?.toString() || "0");
  };

  const handlePaidDaysChange = (val: string) => {
    setPaidDays(val);
    const pdNum = Number(val) || 0;
    const wdNum = Number(workingDaysInMonth) || 26;
    setUnpaidDays(Math.max(0, wdNum - pdNum).toString());
  };

  const handleUnpaidDaysChange = (val: string) => {
    setUnpaidDays(val);
    const udNum = Number(val) || 0;
    const wdNum = Number(workingDaysInMonth) || 26;
    setPaidDays(Math.max(0, wdNum - udNum).toString());
  };

  const handleWorkingDaysChange = (val: string) => {
    setWorkingDaysInMonth(val);
    const wdNum = Number(val) || 26;
    const udNum = Number(unpaidDays) || 0;
    setPaidDays(Math.max(0, wdNum - udNum).toString());
  };

  const handleGenerate = async (action: 'preview' | 'download') => {
    if (!selectedEmp) {
      toast.error("Please select an employee.");
      return;
    }
    const cmsNum = Number(cms);
    if (!cmsNum || cmsNum <= 0) {
      toast.error("Please enter a valid CMS.");
      return;
    }

    const record = buildRecord();

    try {
      toast.info(action === 'preview' ? "Preparing Preview..." : "Generating PDF...");
      const doc = await generateSalarySlip(record, currentMonthName, currentYear);

      if (action === 'preview') {
        const blobUrl = doc.output("bloburl");
        window.open(blobUrl, "_blank");
      } else {
        doc.save(`Quick_Salary_Slip_${selectedEmp.name.replace(/\s+/g, "_")}.pdf`);
        toast.success("Salary Slip downloaded successfully!");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to process PDF.");
    }
  };

  const buildRecord = () => {
    const cmsNum = Number(cms);
    const pd = Math.max(0, Number(paidDays));
    const wd = Math.max(0, Number(workingDaysInMonth));
    const ud = Math.max(0, Number(unpaidDays));
    const ed = Math.max(0, Number(encashDays));
    const ad = Math.max(0, Number(allowanceDays));
    const advIns = Math.max(0, Number(advance));
    const ot = Math.max(0, Number(overtimeHrs));
    const bns = Math.max(0, Number(bonus));

    // 1. Calculations
    const derivedGross = Math.round((cmsNum / wd) * pd);
    const basic = Math.round(derivedGross * 0.50);
    const hra = Math.round(basic * 0.50);

    const hasChildren = (selectedEmp?.salaryStructure?.childrenEducation || 0) > 0;
    const childrenEducation = hasChildren ? Math.round(derivedGross * 0.05) : 0;
    const childrenHostel = hasChildren ? Math.round(derivedGross * 0.05) : 0;

    const totalRemaining = Math.max(0, derivedGross - (basic + hra) - childrenEducation - childrenHostel);
    const conv = Math.round(totalRemaining * 0.40);
    const cons = Math.round(totalRemaining * 0.40);
    const med = Math.round(totalRemaining) - conv - cons;

    const pf = Math.round(Math.min(basic, 15000) * 0.12);

    const esicApplicable = (selectedEmp?.salaryStructure?.esic || 0) > 0;
    const esic = (esicApplicable && basic <= 21000) ? Math.round(basic * 0.0075) : 0;

    const ptAmount = (currentMonthName.toLowerCase() === 'february' || currentMonthName.toLowerCase() === 'feb') ? 300 : 200;
    const pt = selectedEmp?.gender === "FEMALE" ? (cmsNum >= 26000 ? ptAmount : 0) : (cmsNum >= 10000 ? ptAmount : 0);

    const autoReimbursement = Math.round((cmsNum / wd) * ed);
    const computedAllowance = ad * 350;
    const overtimePay = Math.round((cmsNum / wd / 8) * ot);
    const reimbursement = autoReimbursement + overtimePay;

    const subtotalAdditions = basic + hra + conv + cons + med + childrenEducation + childrenHostel + reimbursement + computedAllowance + bns;
    const subtotalDeductions = pf + esic + pt + advIns;
    const netSalary = Math.max(0, subtotalAdditions - subtotalDeductions);

    return {
      user: {
        name: selectedEmp?.name || "",
        id: selectedEmp?.id || "",
        employeeCode: selectedEmp?.employeeCode || "",
        designation: selectedEmp?.designation || "",
        department: selectedEmp?.department?.name || "",
        salaryStructure: selectedEmp?.salaryStructure || {}
      },
      presentDays: pd,
      paidLeave: 0,
      unpaidLeave: ud,
      basic,
      hra,
      conveyance: conv,
      consolidated: cons,
      medical: med,
      childrenEducation,
      childrenHostel,
      allowance: computedAllowance,
      reimbursement: reimbursement,
      bonus: bns,
      providentFund: pf,
      esic,
      professionalTax: pt,
      advance: advIns,
      overtimePay,
      subtotalAdditions,
      subtotalDeductions,
      netSalary
    };
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form Column */}
        <div className="space-y-8 lg:col-span-3">
          {/* Step 1: Employee */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/20 text-primary text-xs font-bold">1</span>
              <h4 className="text-sm font-bold">Select Employee</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={selectedEmpId} onValueChange={handleEmployeeSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step 2: Salary Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <span className="flex items-center justify-center size-5 rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
              <h4 className="text-sm font-bold">Earnings & Attendance</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Gross Salary</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    value={cms}
                    onChange={(e) => setCms(e.target.value)}
                    className="pl-9"
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Paid Days (Prorata)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paidDays}
                  onChange={(e) => handlePaidDaysChange(e.target.value)}
                  placeholder="e.g. 15"
                />
              </div>

              <div className="space-y-2">
                <Label>Unpaid Days</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={unpaidDays}
                  onChange={(e) => handleUnpaidDaysChange(e.target.value)}
                  placeholder="e.g. 0"
                />
              </div>

              <div className="space-y-2">
                <Label>Total Working Days</Label>
                <Input
                  type="number"
                  min="0"
                  value={workingDaysInMonth}
                  onChange={(e) => handleWorkingDaysChange(e.target.value)}
                  placeholder="e.g. 26"
                />
              </div>

              <div className="space-y-2">
                <Label>Encash Days</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={encashDays}
                  onChange={(e) => setEncashDays(e.target.value)}
                  placeholder="e.g. 0"
                />
              </div>

              <div className="space-y-2">
                <Label>Allowance Days</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={allowanceDays}
                  onChange={(e) => setAllowanceDays(e.target.value)}
                  placeholder="e.g. 0"
                />
              </div>

              <div className="space-y-2">
                <Label>Advance / Insurance</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                    className="pl-9"
                    placeholder="e.g. 0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Overtime (hrs)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={overtimeHrs}
                  onChange={(e) => setOvertimeHrs(e.target.value)}
                  placeholder="e.g. 0"
                />
              </div>

              <div className="space-y-2">
                <Label>Annual Bonus (Overrides)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                    className="pl-9"
                    placeholder="e.g. 0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Action */}
          <div className="pt-4 flex justify-end gap-3">
            <Button onClick={() => handleGenerate('preview')} variant="outline" size="lg" className="shadow-sm hover:shadow-primary/10 transition-all font-bold">
              <Eye className="mr-2 size-4" /> Preview
            </Button>
            <Button onClick={() => handleGenerate('download')} size="lg" className="shadow-lg hover:shadow-primary/20 transition-all font-bold">
              <Download className="mr-2 size-4" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Preview Column */}
        <div className="lg:col-span-2 space-y-4 bg-muted/10 p-5 rounded-md border h-fit sticky top-6">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Live Slip Preview</h4>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between font-bold text-primary pb-2 border-b">
              <span>Derived Gross</span>
              <span><IndianRupee className="inline size-3" /> {(buildRecord().basic * 2).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between mt-2 text-muted-foreground">
              <span>Basic</span>
              <span className="text-foreground"><IndianRupee className="inline size-3" /> {buildRecord().basic.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>HRA</span>
              <span className="text-foreground"><IndianRupee className="inline size-3" /> {buildRecord().hra.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Conveyance</span>
              <span className="text-foreground"><IndianRupee className="inline size-3" /> {buildRecord().conveyance.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Consolidated</span>
              <span className="text-foreground"><IndianRupee className="inline size-3" /> {buildRecord().consolidated.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Medical</span>
              <span className="text-foreground"><IndianRupee className="inline size-3" /> {buildRecord().medical.toLocaleString('en-IN')}</span>
            </div>
            {buildRecord().childrenEducation > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Children Education</span>
                <span className="text-foreground"><IndianRupee className="inline size-3" /> {buildRecord().childrenEducation.toLocaleString('en-IN')}</span>
              </div>
            )}
            {buildRecord().childrenHostel > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Children Hostel</span>
                <span className="text-foreground"><IndianRupee className="inline size-3" /> {buildRecord().childrenHostel.toLocaleString('en-IN')}</span>
              </div>
            )}
            {(buildRecord().reimbursement - buildRecord().overtimePay) > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Reimbursement (Encash)</span>
                <span className="text-amber-600"><IndianRupee className="inline size-3" /> {(buildRecord().reimbursement - buildRecord().overtimePay).toLocaleString('en-IN')}</span>
              </div>
            )}
            {buildRecord().overtimePay > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Overtime</span>
                <span className="text-amber-600"><IndianRupee className="inline size-3" /> {buildRecord().overtimePay.toLocaleString('en-IN')}</span>
              </div>
            )}
            {buildRecord().allowance > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Allowance</span>
                <span className="text-amber-600"><IndianRupee className="inline size-3" /> {buildRecord().allowance.toLocaleString('en-IN')}</span>
              </div>
            )}
            {buildRecord().bonus > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Annual Bonus</span>
                <span className="text-amber-600"><IndianRupee className="inline size-3" /> {buildRecord().bonus.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="pt-2 mt-2 border-t flex justify-between font-bold text-emerald-600">
              <span>Gross Salary</span>
              <span><IndianRupee className="inline size-3" /> {buildRecord().subtotalAdditions.toLocaleString('en-IN')}</span>
            </div>

            <div className="pt-2 mt-2 border-t text-muted-foreground">
              {buildRecord().providentFund > 0 && (
                <div className="flex justify-between">
                  <span>Provident Fund</span>
                  <span className="text-rose-500"><IndianRupee className="inline size-3" /> {buildRecord().providentFund.toLocaleString('en-IN')}</span>
                </div>
              )}
              {buildRecord().advance > 0 && (
                <div className="flex justify-between">
                  <span>Advance / Insurance</span>
                  <span className="text-rose-500"><IndianRupee className="inline size-3" /> {buildRecord().advance.toLocaleString('en-IN')}</span>
                </div>
              )}
              {buildRecord().esic > 0 && (
                <div className="flex justify-between">
                  <span>ESIC</span>
                  <span className="text-rose-500"><IndianRupee className="inline size-3" /> {buildRecord().esic.toLocaleString('en-IN')}</span>
                </div>
              )}
              {buildRecord().professionalTax > 0 && (
                <div className="flex justify-between">
                  <span>PT</span>
                  <span className="text-rose-500"><IndianRupee className="inline size-3" /> {buildRecord().professionalTax.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <div className="pt-2 mt-2 border-t flex justify-between font-bold text-rose-600">
              <span>Total Deductions</span>
              <span><IndianRupee className="inline size-3" /> {buildRecord().subtotalDeductions.toLocaleString('en-IN')}</span>
            </div>

            <div className="pt-4 mt-4 border-t flex justify-between font-black text-lg text-foreground">
              <span>Net Payable</span>
              <span><IndianRupee className="inline size-4" /> {buildRecord().netSalary.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>
  );
}
