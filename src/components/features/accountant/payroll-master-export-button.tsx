"use client";

import { ExportButton } from "@/components/ui/export-button";

interface PayrollMasterExportButtonProps {
  data: any[];
  monthName: string;
  year: number;
}

export function PayrollMasterExportButton({ data, monthName, year }: PayrollMasterExportButtonProps) {
  const formatCurrency = (v: any) => typeof v === "number" ? v.toLocaleString('en-IN') : (v || "0");

  let COLUMNS = [
    { header: "Name", key: "user", format: (v: any) => v?.name || "Unknown" },
    { header: "Designation", key: "user", format: (v: any) => v?.designation || "" },
    { header: "Present Days", key: "presentDays" },
    { header: "CMS", key: "grossSalary", format: formatCurrency },
    { header: "Gross Salary", key: "id", format: (_: any, row: any) => formatCurrency((row.basic || 0) + (row.hra || 0) + (row.conveyance || 0) + (row.consolidated || 0) + (row.medical || 0) + (row.childrenEducation || 0) + (row.childrenHostel || 0)) },
    { header: "Basic", key: "basic", format: formatCurrency },
    { header: "HRA", key: "hra", format: formatCurrency },
    { header: "Conveyance", key: "conveyance", format: formatCurrency },
    { header: "Consolidated", key: "consolidated", format: formatCurrency },
    { header: "Medical", key: "medical", format: formatCurrency },
    { header: "Allowance", key: "allowance", format: formatCurrency },
    { header: "Reimbursement", key: "reimbursement", format: formatCurrency },
    { header: "Bonus", key: "bonus", format: formatCurrency },
    { header: "Subtotal Additions", key: "subtotalAdditions", format: formatCurrency },
    { header: "PT", key: "professionalTax", format: formatCurrency },
    { header: "PF", key: "providentFund", format: formatCurrency },
    { header: "ESIC", key: "esic", format: formatCurrency },
    { header: "Advance / Insurance", key: "advance", format: formatCurrency },
    { header: "Subtotal Deductions", key: "subtotalDeductions", format: formatCurrency },
    { header: "Net Payable", key: "netSalary", format: formatCurrency }
  ];

  const hasBonus = data.some((row: any) => (row.bonus || 0) > 0);
  if (!hasBonus) {
    COLUMNS = COLUMNS.filter(c => c.key !== "bonus");
  }

  return (
    <ExportButton
      filename={`salary-slips-${monthName.toLowerCase()}-${year}`}
      title={`Salary Slips & Payroll Table — ${monthName} ${year}`}
      subtitle={`${data.length} records · Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
      columns={COLUMNS}
      rows={data}
      label="Export Payroll"
      pdfFormat="a3"
    />
  );
}
