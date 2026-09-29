"use client";

/**
 * Thin client wrapper around ExportButton for the Payroll Ledger.
 * Bakes in column definitions (which include format functions) so the
 * Server Component parent only passes a plain serializable data array.
 */

import { ExportButton } from "@/components/ui/export-button";

interface PayrollExportButtonProps {
  data: any[];
  monthName: string;
  year: number;
}

export function PayrollExportButton({ data, monthName, year }: PayrollExportButtonProps) {
  const COLUMNS = [
    { header: "Name", key: "name" },
    { header: "Present Days", key: "totalPresent" },
    { header: "Leaves Taken", key: "leavesTaken" },
    { header: "Total Late", key: "totalLate" },
    { header: "Actual Late", key: "actualLate" },
    { header: "Special Case Late", key: "specialCaseLate" },
    { header: "Penalty Late", key: "punishableLate" },
    { header: "Early Logoff", key: "totalEarlyLogoff" },
    { header: "LWP Days", key: "lwpDays", format: (v: any) => Number(v).toFixed(1) },
    { header: "Encashable Days", key: "encashableDays" },
    { header: "Allowance Days", key: "allowanceDays" },
    { header: "Monthly Balance", key: "balances", format: (v: any) => v?.full ?? 0 },
    { header: "Short Balance", key: "balances", format: (v: any) => v?.short ?? 0 },
    { header: "Semi-Annual Balance", key: "balances", format: (v: any) => v?.semiAnnual ?? 0 },
    { header: "Off-Site Count", key: "offSiteCount" },
  ];

  return (
    <ExportButton
      filename={`payroll-ledger-${monthName.toLowerCase()}-${year}`}
      title={`Payroll Ledger — ${monthName} ${year}`}
      subtitle={`${data.length} staff members · Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`}
      columns={COLUMNS}
      rows={data}
      label="Export Ledger"
    />
  );
}
