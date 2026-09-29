"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Table2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToPdf, type ExportOptions } from "@/lib/export";

interface ExportButtonProps extends Omit<ExportOptions, "filename"> {
  filename: string;
  /** Optional label override */
  label?: string;
  /** compact = icon-only button */
  compact?: boolean;
  disabled?: boolean;
}

export function ExportButton({
  filename,
  title,
  subtitle,
  columns,
  rows,
  label = "Export",
  compact = false,
  disabled = false,
  ...rest
}: ExportButtonProps) {
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  const opts: ExportOptions = { filename, title, subtitle, columns, rows, ...rest };

  const handleExcel = async () => {
    if (rows.length === 0) { toast.warning("No data to export"); return; }
    setLoading("excel");
    try {
      exportToExcel(opts);
      toast.success(`Exported ${rows.length} rows to Excel`);
    } catch (e: any) {
      toast.error("Excel export failed: " + e.message);
    } finally {
      setLoading(null);
    }
  };

  const handlePdf = async () => {
    if (rows.length === 0) { toast.warning("No data to export"); return; }
    setLoading("pdf");
    try {
      await exportToPdf(opts);
      toast.success(`Exported ${rows.length} rows as PDF`);
    } catch (e: any) {
      toast.error("PDF export failed: " + e.message);
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest rounded-sm border-border/60 hover:bg-muted/10 transition-all disabled:opacity-50"
          disabled={disabled || isLoading}
        >
          {isLoading
            ? <Loader2 className="size-3.5 animate-spin" />
            : <Download className="size-3.5" />
          }
          {!compact && <span>{isLoading ? (loading === "pdf" ? "Generating…" : "Exporting…") : label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 border-border/60 rounded-sm shadow-lg">
        <DropdownMenuItem
          className="gap-2.5 text-[11px] font-bold cursor-pointer hover:bg-muted/10"
          onClick={handleExcel}
          disabled={isLoading}
        >
          <Table2 className="size-3.5 text-emerald-600" />
          <div className="flex flex-col">
            <span>Export Excel</span>
            <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider">Spreadsheet</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 text-[11px] font-bold cursor-pointer hover:bg-muted/10"
          onClick={handlePdf}
          disabled={isLoading}
        >
          <FileText className="size-3.5 text-rose-500" />
          <div className="flex flex-col">
            <span>Export PDF</span>
            <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider">Printable report</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
