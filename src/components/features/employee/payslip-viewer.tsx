"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, ReceiptIndianRupee } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { generatePayslipPDFBase64 } from "@/actions/payroll/payslip";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardTabs } from "@/components/features/dashboard/dashboard-tabs";

interface PayslipViewerProps {
  payslips: any[];
}

const COLORS = ['#22c55e', '#ef4444']; // Green for Take Home, Red for Deductions

export function PayslipViewer({ payslips }: PayslipViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!payslips || payslips.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">My Payslips</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">View and download your monthly salary slips</p>
          </div>
        </div>

        <DashboardTabs />

        <div className="flex-1">
          <Card className="flex flex-col items-center justify-center py-24 text-center border-dashed">
            <ReceiptIndianRupee className="size-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No Payslips Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You don't have any finalized payslips yet.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const selectedRecord = payslips[selectedIndex];
  const date = new Date(selectedRecord.year, selectedRecord.month - 1);
  const monthYearLabel = format(date, "MMMM yyyy");

  const takeHome = selectedRecord.netSalary || 0;
  const deductions = selectedRecord.subtotalDeductions || 0;
  const grossPay = selectedRecord.subtotalAdditions || 0;

  const chartData = [
    { name: "Take Home", value: takeHome },
    { name: "Deductions", value: deductions }
  ];

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const res = await generatePayslipPDFBase64(selectedRecord.id);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      if (res.base64 && res.filename) {
        // Create an invisible link to trigger download
        const link = document.createElement("a");
        link.href = res.base64;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Payslip downloaded successfully");
      }
    } catch (error) {
      toast.error("Failed to download payslip");
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })}`;
  };

  const earningsList = [
    { label: "Basic", value: selectedRecord.basic },
    { label: "House Rent Allowance", value: selectedRecord.hra },
    { label: "Conveyance Allowance", value: selectedRecord.conveyance },
    { label: "Consolidated Allowance", value: selectedRecord.consolidated },
    { label: "Medical Allowance", value: selectedRecord.medical },
    { label: "Allowance", value: selectedRecord.allowance },
    { label: "Reimbursement", value: selectedRecord.reimbursement },
    { label: "Overtime Pay", value: selectedRecord.overtimePay },
    { label: "Bonus", value: selectedRecord.bonus },
  ].filter(item => item.value > 0);

  const deductionsList = [
    { label: "Provident Fund", value: selectedRecord.providentFund },
    { label: "Professional Tax", value: selectedRecord.professionalTax },
    { label: "ESIC", value: selectedRecord.esic },
    { label: "TDS", value: selectedRecord.tds },
    { label: "Advance / Insurance", value: selectedRecord.advance },
    { label: "Unpaid Leave Deduction", value: selectedRecord.unpaidLeaveDeduction },
  ].filter(item => item.value > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">My Payslips</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">View and download your monthly salary slips</p>
        </div>
        <Button onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <span className="flex items-center gap-2">Downloading...</span>
          ) : (
            <span className="flex items-center gap-2">
              <Download className="size-4" /> Download PDF
            </span>
          )}
        </Button>
      </div>

      <DashboardTabs />

      <div className="flex-1 space-y-4">

        {/* Month Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide pb-2 gap-2 border-b">
          {payslips.map((p, idx) => {
            const d = new Date(p.year, p.month - 1);
            const isActive = idx === selectedIndex;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedIndex(idx)}
                className={`px-4 py-2 whitespace-nowrap text-sm font-medium transition-colors ${isActive
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {format(d, "MMMM yyyy")}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Overview Chart */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {monthYearLabel} Overview
              </CardTitle>
              <CardDescription>Distribution between Take Home and Deductions</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center px-6 pb-6 pt-2">
              <div className="h-[120px] w-full relative mt-2 mb-2">
                <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end text-center pointer-events-none pb-1 z-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Gross Pay</span>
                  <span className="text-xl font-bold leading-none">{formatCurrency(grossPay)}</span>
                </div>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} className="relative z-10">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="100%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => formatCurrency(Number(value) || 0)}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      wrapperStyle={{ zIndex: 100 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex w-full justify-between items-center text-xs mt-6 pt-4 border-t">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-muted-foreground font-medium">Take Home:</span>
                  <span className="font-bold">{formatCurrency(takeHome)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-muted-foreground font-medium">Deductions:</span>
                  <span className="font-bold">{formatCurrency(deductions)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details List */}
          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle className="text-lg">Salary Breakdown</CardTitle>
              <CardDescription>Earnings and Deductions for {monthYearLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3">Earnings (+)</h4>
                <div className="space-y-2">
                  {earningsList.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t">
                    <span>Total Gross Pay</span>
                    <span>{formatCurrency(grossPay)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3">Deductions (-)</h4>
                <div className="space-y-2">
                  {deductionsList.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  {deductionsList.length === 0 && (
                    <p className="text-sm text-muted-foreground">No deductions</p>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t">
                    <span>Total Deductions</span>
                    <span>{formatCurrency(deductions)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-base font-bold pt-4 mt-4 border-t border-border/60 text-primary">
                <span>Net Payable (Take Home)</span>
                <span>{formatCurrency(takeHome)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
