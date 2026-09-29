"use client";

import React, { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Download, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { generateMonthlyPayroll, updatePayrollRecord, deletePayrollRecord } from "@/actions/payroll/record";
import { emailSalarySlipAction } from "@/actions/payroll/payslip";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { generateSalarySlip } from "@/lib/pdf/generate-salary-slip";
import { isDummyOrDevEmail } from "@/lib/app-config";
import { Edit2, Check, X, Eye, Trash2, MoreHorizontal, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PayrollMasterExportButton } from "./payroll-master-export-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export function PayrollMasterTable({
  data,
  month,
  monthName,
  year
}: {
  data: any[];
  month: number;
  monthName: string;
  year: number;
}) {
  // Dynamically calculate working days in month (excluding Sundays)
  const totalDays = new Date(year, month, 0).getDate();
  let workingDaysInMonth = 0;
  for (let d = 1; d <= totalDays; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) workingDaysInMonth++;
  }

  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [newReimb, setNewReimb] = useState("");
  const [newAdvance, setNewAdvance] = useState("");
  const [newAllowance, setNewAllowance] = useState("");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [payBonus, setPayBonus] = useState(false);
  const [emailingRowId, setEmailingRowId] = useState<string | null>(null);
  const [isEmailingAll, setIsEmailingAll] = useState(false);
  const [emailAllDialogOpen, setEmailAllDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await generateMonthlyPayroll(month, year, forceRegenerate, undefined, payBonus);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error("Failed to generate payroll");
      }
    } catch (e: any) {
      toast.error(e.message || "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async (row: any) => {
    try {
      const doc = await generateSalarySlip(row, monthName, year);
      doc.save(`SalarySlip_${row.user.name.replace(/\s+/g, '_')}_${monthName}_${year}.pdf`);
    } catch (e) {
      toast.error("Failed to generate PDF");
    }
  };

  const handlePreviewPdf = async (row: any) => {
    try {
      const doc = await generateSalarySlip(row, monthName, year);
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    } catch (e) {
      toast.error("Failed to preview PDF");
    }
  };

  const filteredData = data.filter(row =>
    row.user?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasBonus = data.some((row: any) => (row.bonus || 0) > 0);

  const startEditRow = (row: any) => {
    setEditingRowId(row.id);
    setNewReimb(row.reimbursement?.toString() || "0");
    setNewAdvance(row.advance?.toString() || "0");
    setNewAllowance(row.allowance?.toString() || "0");
  };

  const saveRow = async (rowId: string) => {
    try {
      const reimbVal = parseFloat(newReimb);
      const advVal = parseFloat(newAdvance);
      const allwVal = parseFloat(newAllowance);

      if (isNaN(reimbVal) || isNaN(advVal) || isNaN(allwVal)) {
        toast.error("Invalid values provided");
        return;
      }

      const res = await updatePayrollRecord(rowId, {
        reimbursement: reimbVal,
        advance: advVal,
        allowance: allwVal
      });

      if (res.success) {
        toast.success("Payroll record updated");
        setEditingRowId(null);
        router.refresh();
      } else {
        toast.error("Failed to update record");
      }
    } catch (error) {
      toast.error("Error updating record");
    }
  };

  const handleEmailSlip = async (row: any) => {
    setEmailingRowId(row.id);
    try {
      const res = await emailSalarySlipAction(row.id, monthName, year);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message || "Failed to send email");
      }
    } catch (e) {
      toast.error("An error occurred while sending");
    } finally {
      setEmailingRowId(null);
    }
  };

  const handleEmailAllClick = () => {
    const targetData = filteredData.filter(row => !isDummyOrDevEmail(row.user?.email));
    if (targetData.length === 0) {
      toast.info("No eligible employees found to email.");
      return;
    }
    setEmailAllDialogOpen(true);
  };

  const handleEmailAllSlipsConfirmed = async () => {
    const targetData = filteredData.filter(row => !isDummyOrDevEmail(row.user?.email));

    setIsEmailingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of targetData) {
      setEmailingRowId(row.id);
      try {
        const res = await emailSalarySlipAction(row.id, monthName, year);
        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    setEmailingRowId(null);
    setIsEmailingAll(false);
    toast.success(`Batch emails finished: ${successCount} sent, ${failCount} failed.`);
  };

  const handleResetUser = async (userId: string) => {
    try {
      const loadingToast = toast.loading("Resetting user's payroll...");
      const res = await generateMonthlyPayroll(month, year, true, userId);
      toast.dismiss(loadingToast);

      if (res.success) {
        toast.success("Payroll reset successfully");
        router.refresh();
      } else {
        toast.error("Failed to reset payroll");
      }
    } catch (error) {
      toast.error("An error occurred during reset");
    }
  };

  const handleDeleteRecordConfirmed = async (recordId: string) => {
    try {
      const loadingToast = toast.loading("Deleting record...");
      const res = await deletePayrollRecord(recordId);
      toast.dismiss(loadingToast);

      if (res.success) {
        toast.success("Record deleted successfully");
        router.refresh();
      } else {
        toast.error("Failed to delete record");
      }
    } catch (error) {
      toast.error("An error occurred during deletion");
    } finally {
      setRecordToDelete(null);
    }
  };

  return (
    <div className="space-y-0 w-full">
      <div className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 border-b border-border/70">
        <div className="relative w-full md:flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 border-border/70 focus:ring-primary/20 transition-all rounded-md text-xs bg-background"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 bg-background/50 px-2.5 py-1.5 rounded-md border border-border/50">
            <Switch id="force-regen" checked={forceRegenerate} onCheckedChange={setForceRegenerate} />
            <Label htmlFor="force-regen" className="text-[10px] font-semibold cursor-pointer">
              Overwrite Manual Edits
            </Label>
          </div>
          <div className="flex items-center space-x-2 bg-amber-500/10 px-2.5 py-1.5 rounded-md border border-amber-500/20">
            <Switch id="pay-bonus" checked={payBonus} onCheckedChange={setPayBonus} className="data-[state=checked]:bg-amber-500" />
            <Label htmlFor="pay-bonus" className="text-[10px] font-semibold cursor-pointer text-amber-700 dark:text-amber-500">
              Pay Annual Bonus
            </Label>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[11px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={handleEmailAllClick}
            disabled={isEmailingAll || isGenerating}
          >
            {isEmailingAll ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <FileText className="size-3.5 mr-2" />}
            Email All Slips
          </Button>

          <PayrollMasterExportButton data={filteredData} monthName={monthName} year={year} />
          <Button
            size="sm"
            variant="default"
            className="h-8 text-[11px] font-bold"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : <FileText className="size-3.5 mr-2" />}
            Generate {monthName} Payroll
          </Button>
        </div>
      </div>

      <div className="w-full">
        <Table className="border-collapse text-[10px] whitespace-nowrap min-w-max" containerClassName="max-h-[calc(100vh-250px)]">
          <TableHeader className="bg-muted sticky top-0 z-30 shadow-sm">
            <TableRow>
              <TableHead className="font-bold border-r md:sticky md:left-0 md:bg-muted md:z-40 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Employee</TableHead>
              <TableHead className="font-bold border-r text-center">Month</TableHead>
              <TableHead className="font-bold border-r text-center">Present Days</TableHead>
              <TableHead className="font-bold border-r text-center bg-primary/10">CMS</TableHead>
              <TableHead className="font-bold border-r text-center">Gross Salary</TableHead>
              <TableHead className="font-bold border-r text-center">Basic</TableHead>
              <TableHead className="font-bold border-r text-center">HRA</TableHead>
              <TableHead className="font-bold border-r text-center">Conveyance</TableHead>
              <TableHead className="font-bold border-r text-center">Consolidated</TableHead>
              <TableHead className="font-bold border-r text-center">Medical</TableHead>
              <TableHead className="font-bold border-r text-center">Allowance</TableHead>
              <TableHead className="font-bold border-r text-center text-primary">Reimbursement</TableHead>
              {hasBonus && <TableHead className="font-bold border-r text-center text-amber-600">Bonus</TableHead>}
              <TableHead className="font-bold border-r text-center bg-primary/10">Subtotal Add</TableHead>
              <TableHead className="font-bold border-r text-center text-rose-600 bg-rose-500/10">PT</TableHead>
              <TableHead className="font-bold border-r text-center text-rose-600 bg-rose-500/10">PF</TableHead>
              <TableHead className="font-bold border-r text-center text-rose-600 bg-rose-500/10">ESIC</TableHead>
              <TableHead className="font-bold border-r text-center text-rose-600 bg-rose-500/10">Advance / Insurance</TableHead>
              <TableHead className="font-bold border-r text-center bg-rose-500/20 text-rose-700">Subtotal Ded</TableHead>
              <TableHead className="font-bold border-r text-center bg-emerald-500/20 text-emerald-800">NET PAYABLE</TableHead>
              <TableHead className="font-bold text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={21} className="text-center py-10 text-muted-foreground">
                  No payroll records found. Generate them first.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="py-3 px-5 border-r border-border/40 font-medium bg-card md:sticky md:left-0 md:z-20 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 rounded-full shrink-0">
                        {row.user?.avatarUrl && (
                          <AvatarImage src={row.user.avatarUrl} alt={row.user.name} className="object-cover rounded-full" />
                        )}
                        <AvatarFallback className="bg-muted text-muted-foreground font-bold text-[9px] group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center size-full rounded-full">
                          {getInitials(row.user?.name || '')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[11px] text-foreground truncate max-w-35 leading-tight" title={row.user?.name}>{row.user?.name}</span>
                        <span className="text-[9px] text-muted-foreground truncate">{row.user?.designation || 'Employee'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="border-r text-center tabular-nums">{month}</TableCell>
                  <TableCell className="border-r text-center tabular-nums font-medium">
                    {row.presentDays || 0}
                  </TableCell>
                  <TableCell className="border-r text-center tabular-nums font-bold text-primary bg-primary/5">
                    {row.grossSalary?.toLocaleString() || '--'}
                  </TableCell>
                  <TableCell className="border-r text-center tabular-nums font-bold">
                    {((row.basic || 0) + (row.hra || 0) + (row.conveyance || 0) + (row.consolidated || 0) + (row.medical || 0) + (row.childrenEducation || 0) + (row.childrenHostel || 0)).toLocaleString()}
                  </TableCell>
                  <TableCell className="border-r text-center tabular-nums">{row.basic?.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-center tabular-nums">{row.hra?.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-center tabular-nums">{row.conveyance?.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-center tabular-nums">{row.consolidated?.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-center tabular-nums">{row.medical?.toLocaleString()}</TableCell>

                  {/* Allowance Editable */}
                  <TableCell className="border-r text-center tabular-nums font-medium">
                    {editingRowId === row.id ? (
                      <Input type="number" min="0" className="h-6 w-16 text-center text-[10px] px-1 mx-auto" value={newAllowance} onChange={e => setNewAllowance(e.target.value)} />
                    ) : (
                      row.allowance?.toLocaleString() || '0'
                    )}
                  </TableCell>

                  {/* Reimbursement Editable */}
                  <TableCell className="border-r text-center tabular-nums text-primary font-medium">
                    {editingRowId === row.id ? (
                      <Input type="number" min="0" className="h-6 w-16 text-center text-[10px] px-1 mx-auto" value={newReimb} onChange={e => setNewReimb(e.target.value)} />
                    ) : (
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger className="underline decoration-dashed decoration-primary/50 underline-offset-2 hover:text-primary">
                          {row.reimbursement?.toLocaleString() || '0'}
                        </TooltipTrigger>
                        <TooltipContent side="top" className="flex flex-col items-stretch gap-1.5 min-w-48 p-3 font-medium bg-popover text-popover-foreground border shadow-md [&_svg]:fill-popover! [&_svg]:bg-popover! [&_svg]:text-popover! [&_svg]:border-popover!">
                          {(() => {
                            const totalReimb = row.reimbursement || 0;
                            const otPay = row.overtimePay || 0;
                            const extraDaysPay = Math.round(((row.grossSalary || 0) / workingDaysInMonth) * (row.extraDays || 0));
                            const encashPay = Math.max(0, totalReimb - otPay - extraDaysPay);
                            
                            const otHrs = row.grossSalary ? Math.round(((otPay * 8 * workingDaysInMonth) / row.grossSalary) * 10) / 10 : 0;
                            const encashDays = row.grossSalary ? Math.round(((encashPay * workingDaysInMonth) / row.grossSalary) * 10) / 10 : 0;
                            const exDays = row.extraDays || 0;

                            return (
                              <>
                                <div className="flex justify-between items-center gap-6"><span>Overtime {otHrs > 0 ? `(${otHrs}hr)` : ''}:</span> <span className="font-bold text-amber-500 tabular-nums">+{otPay.toLocaleString()}</span></div>
                                <div className="flex justify-between items-center gap-6"><span>Extra Work {exDays > 0 ? `(${exDays}d)` : ''}:</span> <span className="font-bold text-blue-500 tabular-nums">+{extraDaysPay.toLocaleString()}</span></div>
                                <div className="flex justify-between items-center gap-6"><span>Encash {encashDays > 0 ? `(${encashDays}d)` : ''}:</span> <span className="font-bold text-emerald-500 tabular-nums">+{encashPay.toLocaleString()}</span></div>
                                <div className="border-t border-border/40 my-1 pt-1.5 flex justify-between items-center gap-6"><span>Total Reimbursement:</span> <span className="font-bold text-primary text-[12px] tabular-nums">{totalReimb.toLocaleString()}</span></div>
                              </>
                            );
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>

                  {hasBonus && <TableCell className="border-r text-center tabular-nums text-amber-600 font-bold">{row.bonus?.toLocaleString() || '0'}</TableCell>}

                  <TableCell className="border-r text-center tabular-nums bg-primary/5 font-bold">{row.subtotalAdditions?.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-center tabular-nums text-rose-500">{row.professionalTax?.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-center tabular-nums text-rose-500">{row.providentFund?.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-center tabular-nums text-rose-500">{row.esic?.toLocaleString() || '0'}</TableCell>

                  {/* Advance Editable */}
                  <TableCell className="border-r text-center tabular-nums text-rose-500 font-medium">
                    {editingRowId === row.id ? (
                      <Input type="number" min="0" className="h-6 w-16 text-center text-[10px] px-1 mx-auto" value={newAdvance} onChange={e => setNewAdvance(e.target.value)} />
                    ) : (
                      row.advance?.toLocaleString() || '0'
                    )}
                  </TableCell>

                  <TableCell className="border-r text-center tabular-nums bg-rose-500/5 font-bold text-rose-600">{row.subtotalDeductions?.toLocaleString()}</TableCell>

                  <TableCell className="border-r text-center tabular-nums bg-emerald-500/10 font-bold text-emerald-700">{row.netSalary?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell className="text-center">
                    {editingRowId === row.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => saveRow(row.id)}>
                          <Check className="size-3 mr-1" /> Save
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] text-muted-foreground hover:bg-muted" onClick={() => setEditingRowId(null)}>
                          <X className="size-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px]" onClick={() => handlePreviewPdf(row)}>
                          <Eye className="size-3" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px]">
                              <MoreHorizontal className="size-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            <DropdownMenuItem onClick={() => startEditRow(row)}>
                              <Edit2 className="size-3 mr-2" /> Edit Adjustments
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPdf(row)}>
                              <Download className="size-3 mr-2" /> Download Slip
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={emailingRowId === row.id || isDummyOrDevEmail(row.user?.email)}
                              onClick={(e) => {
                                e.preventDefault();
                                handleEmailSlip(row);
                              }}
                              className="text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                            >
                              {emailingRowId === row.id ? (
                                <Loader2 className="size-3 mr-2 animate-spin" />
                              ) : (
                                <FileText className="size-3 mr-2" />
                              )}
                              Email Slip
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleResetUser(row.userId)} className="text-amber-600 focus:text-amber-700 focus:bg-amber-50">
                              <RefreshCw className="size-3 mr-2" /> Reset Manual Edits
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setRecordToDelete(row.id)} className="text-rose-600 focus:text-rose-700 focus:bg-rose-50">
                              <Trash2 className="size-3 mr-2" /> Delete Record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={emailAllDialogOpen} onOpenChange={setEmailAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Salary Slips</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send salary slips to all {filteredData.filter(r => !isDummyOrDevEmail(r.user?.email)).length} eligible employees?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setEmailAllDialogOpen(false);
              handleEmailAllSlipsConfirmed();
            }}>Send Emails</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the generated payroll record for this employee? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => {
              if (recordToDelete) handleDeleteRecordConfirmed(recordToDelete);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
