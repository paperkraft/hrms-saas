/**
 * Shared export utilities for CSV and PDF.
 * No React — pure functions that work from any client component.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportColumn {
  header: string;
  key: string;
  /** Optional value transformer */
  format?: (val: any, row: any) => string;
}

export interface ExportOptions {
  filename: string;
  title?: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
  pdfFormat?: "a4" | "a3" | "a2" | "a1" | "a0" | "letter" | "legal";
  pdfOrientation?: "portrait" | "landscape";
  pdfFontSize?: number;
  pdfCellPadding?: number;
}

export function exportToExcel(opts: ExportOptions) {
  const { filename, columns, rows } = opts;

  // Dynamically import xlsx
  import("xlsx").then((XLSX) => {
    // 1. Prepare header row
    const headers = columns.map((c) => c.header);
    
    const cellFormats: Record<string, string> = {};

    // 2. Prepare data rows (parse formatted currency/numeric values into true numbers so Excel formulas work)
    const dataRows = rows.map((row, rowIndex) =>
      columns.map((c, colIndex) => {
        const raw = row[c.key];
        const val = c.format ? c.format(raw, row) : (raw ?? "");

        if (typeof val === "number") {
          return Number.isNaN(val) ? "" : val;
        }

        if (typeof val === "string" && val.trim() !== "") {
          const hasCommaOrCurrency = /[,₹$€£]/.test(val);
          const cleaned = val.replace(/,/g, "").replace(/^[₹$€£]\s?/, "").trim();
          const isLeadingZeroCode = /^0\d+$/.test(cleaned);

          if (!isLeadingZeroCode && /^-?\d+(\.\d+)?$/.test(cleaned)) {
            const num = Number(cleaned);
            if (!Number.isNaN(num)) {
              if (hasCommaOrCurrency) {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
                cellFormats[cellRef] = Number.isInteger(num) ? "#,##0" : "#,##0.00";
              }
              return num;
            }
          }
        }

        return val ?? "";
      })
    );

    // Combine headers and data
    const worksheetData = [headers, ...dataRows];

    // Create worksheet and workbook
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Apply number format to specific currency/formatted cells
    for (const [cellRef, numFmt] of Object.entries(cellFormats)) {
      if (worksheet[cellRef]) {
        worksheet[cellRef].z = numFmt;
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Generate buffer and save
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }).catch(e => {
    console.error("Failed to load xlsx for export:", e);
  });
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function exportToPdf(opts: ExportOptions) {
  // Dynamic import — keeps jspdf out of the initial bundle
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const { 
    filename, 
    title, 
    subtitle, 
    columns, 
    rows,
    pdfFormat = "a4",
    pdfOrientation = "landscape",
    pdfFontSize = 8,
    pdfCellPadding = 5
  } = opts;

  const doc = new jsPDF({ orientation: pdfOrientation, unit: "pt", format: pdfFormat });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 36;

  // Title
  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(title, 40, y);
    y += 20;
  }

  // Subtitle / date range
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 40, y);
    y += 16;
  }

  // Generated on
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const generatedStr = `Generated on ${new Date().toLocaleString()}`;
  doc.text(generatedStr, pageWidth - 40, 30, { align: "right" });

  // Table
  autoTable(doc, {
    startY: y + 4,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) =>
      columns.map((c) => {
        const raw = row[c.key];
        return c.format ? c.format(raw, row) : (raw ?? "");
      })
    ),
    styles: {
      fontSize: pdfFontSize,
      cellPadding: pdfCellPadding,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [37, 99, 235], // primary blue
      textColor: 255,
      fontStyle: "bold",
      fontSize: pdfFontSize,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
