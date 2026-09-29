"use client"

import { useState, useRef } from "react"
import ExcelJS from "exceljs"
import * as XLSX from "xlsx"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  Button,
  Badge,
} from "@/components/ui"
import { Download, Upload, AlertCircle, CheckCircle2, RotateCw, FileSpreadsheet } from "lucide-react"
import { bulkInsertTaskMasters } from "@/actions/task-master"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface BulkImportTaskMasterDialogProps {
  departments: { id: string; name: string }[]
}

interface ParsedRow {
  rowNumber: number
  name: string
  activity: string
  defaultDurationDays: number | null
  deptName: string
  departmentId: string
  isValid: boolean
  errors: string[]
}

export function BulkImportTaskMasterDialog({ departments }: BulkImportTaskMasterDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [fileName, setFileName] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      
      // Sheet 1: Main task templates input sheet
      const sheet = workbook.addWorksheet("Task Templates")
      
      // Setup Columns
      sheet.columns = [
        { header: "Task Name", key: "name", width: 40 },
        { header: "Activity Type", key: "activity", width: 22 },
        { header: "Default Duration (Days)", key: "duration", width: 25 },
        { header: "Department Name", key: "department", width: 22 }
      ]

      // Style Header Row (Row 1)
      const headerRow = sheet.getRow(1)
      headerRow.height = 26
      headerRow.font = { name: "Segoe UI", bold: true, size: 10, color: { argb: "FFFFFFFF" } }
      headerRow.alignment = { vertical: "middle", horizontal: "center" }
      
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4F46E5" } // Tailwind Indigo-600
        }
        cell.border = {
          top: { style: "thin", color: { argb: "FFC7D2FE" } },
          left: { style: "thin", color: { argb: "FFC7D2FE" } },
          bottom: { style: "thin", color: { argb: "FFC7D2FE" } },
          right: { style: "thin", color: { argb: "FFC7D2FE" } }
        }
      })

      // Add Sample Rows
      const sampleData = [
        ["Design System Wireframes", "UI/UX Design", 4, "Software"],
        ["Database Query Performance Review", "Database", 2, "Software"],
        ["Concrete Grade Lab Testing", "Civil Lab Test", 3, "Laboratory"],
        ["Setup CI/CD Pipeline", "DevOps", 1.5, "Software"],
        ["Monthly Accounting Closing", "Account Management", 5, "Administration"]
      ]

      sampleData.forEach(row => {
        sheet.addRow(row)
      })

      // Sheet 2: Department References
      const refSheet = workbook.addWorksheet("Valid Departments")
      refSheet.columns = [
        { header: "Department List", key: "name", width: 25 }
      ]
      
      const refHeaderRow = refSheet.getRow(1)
      refHeaderRow.height = 24
      refHeaderRow.font = { name: "Segoe UI", bold: true, size: 10, color: { argb: "FFFFFFFF" } }
      refHeaderRow.alignment = { vertical: "middle", horizontal: "center" }
      refHeaderRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4B5563" } // Gray-600
      }

      departments.forEach(dept => {
        refSheet.addRow([dept.name])
      })

      const deptListFormula = `'Valid Departments'!$A$2:$A$${departments.length + 1}`

      for (let i = 2; i <= 200; i++) {
        const row = sheet.getRow(i)
        
        row.getCell(4).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [deptListFormula],
          showErrorMessage: true,
          errorTitle: "Invalid Department Selection",
          error: "Please pick a valid department from the dropdown list."
        }

        row.getCell(3).dataValidation = {
          type: "decimal",
          operator: "greaterThanOrEqual",
          allowBlank: true,
          formulae: ["0"],
          showErrorMessage: true,
          errorTitle: "Invalid Duration Value",
          error: "Duration must be a positive number or 0 (0 indicates a continuous task)."
        }

        row.eachCell((cell) => {
          cell.font = { name: "Segoe UI", size: 10 }
        })
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = window.URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = url
      link.download = "TaskMaster_Import_Template.xlsx"
      link.click()
      
      window.URL.revokeObjectURL(url)
      toast.success("Pre-formatted Excel template downloaded")
    } catch (err: any) {
      toast.error("Failed to generate Excel template: " + err.message)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })

        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]

        const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 })

        if (rawRows.length === 0) {
          toast.error("The uploaded file is empty")
          return
        }

        const dataRows = rawRows.slice(1) // Skip header row

        const parsed: ParsedRow[] = dataRows
          .filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== null && cell !== ""))
          .map((row, index) => {
            const name = row[0]?.toString().trim() || ""
            const activity = row[1]?.toString().trim() || ""
            const durationRaw = row[2]
            const deptName = row[3]?.toString().trim() || ""

            let defaultDurationDays: number | null = null
            const errors: string[] = []

            if (!name) {
              errors.push("Task Name is required")
            } else if (name.length < 2) {
              errors.push("Task Name must be at least 2 characters")
            }

            if (durationRaw !== undefined && durationRaw !== null && durationRaw !== "") {
              const num = parseFloat(durationRaw)
              if (isNaN(num) || num < 0) {
                errors.push("Duration must be a positive number or 0")
              } else {
                defaultDurationDays = num
              }
            }

            if (!deptName) {
              errors.push("Department Name is required")
            } else {
              const matchedDept = departments.find(
                d => d.name.toLowerCase() === deptName.toLowerCase()
              )
              if (!matchedDept) {
                errors.push(`Department '${deptName}' does not exist`)
              } else {
                row[4] = matchedDept.id
              }
            }

            return {
              rowNumber: index + 2,
              name,
              activity,
              defaultDurationDays,
              deptName,
              departmentId: row[4] || "",
              isValid: errors.length === 0,
              errors
            }
          })

        setParsedRows(parsed)
      } catch (error) {
        toast.error("Failed to parse Excel file. Make sure it's in the correct format.")
      }
    }

    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid)
    if (validRows.length === 0) {
      toast.error("No valid rows to import")
      return
    }

    setIsUploading(true)
    const dataToSubmit = validRows.map(r => ({
      name: r.name,
      activity: r.activity || undefined,
      defaultDurationDays: r.defaultDurationDays === 0 ? null : (r.defaultDurationDays || null),
      departmentId: r.departmentId
    }))

    const result = await bulkInsertTaskMasters(dataToSubmit)
    setIsUploading(false)

    if (result.success) {
      toast.success(`Successfully imported ${result.count} task templates!`)
      setOpen(false)
      resetState()
      router.refresh()
    } else {
      toast.error(result.error || "Failed to import task templates")
    }
  }

  const resetState = () => {
    setParsedRows([])
    setFileName("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const totalRows = parsedRows.length
  const validCount = parsedRows.filter(r => r.isValid).length
  const invalidCount = totalRows - validCount

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3.5 text-xs font-semibold gap-2 rounded-md border-border/80 hover:bg-muted cursor-pointer">
          <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>Bulk Import</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="p-0 rounded-2xl border border-border shadow-2xl overflow-hidden sm:max-w-[650px] max-h-[88vh] flex flex-col gap-0 bg-card"
      >
        <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4 border-b border-border/80">
          <DialogHeader className="gap-1">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                  Bulk Import Task Templates
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Upload an Excel spreadsheet to import multiple standardized task templates simultaneously
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 overscroll-contain">
          {/* Step 1: Download Template */}
          <div className="rounded-xl border border-border/70 p-4 bg-muted/20 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground">1. Download Blank Excel Template</h4>
              <p className="text-[11px] text-muted-foreground">
                Includes valid column headers, dropdown validation, and department listings.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="h-8 text-xs font-semibold rounded-md shrink-0 gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Download</span>
            </Button>
          </div>

          {/* Step 2: Upload Excel File */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-foreground">2. Upload Completed Template</h4>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/70 hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/10 flex flex-col items-center justify-center gap-2"
            >
              <Upload className="size-6 text-muted-foreground/60" />
              {fileName ? (
                <span className="text-xs font-semibold text-primary">{fileName}</span>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Click or drag Excel spreadsheet here</p>
                  <p className="text-[11px] text-muted-foreground">Supports .xlsx and .xls formats</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">3. Validation Preview</h4>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/25">
                    {validCount} Valid
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="outline" className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25">
                      {invalidCount} Error{invalidCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 overflow-hidden bg-background">
                <div className="max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/60 sticky top-0">
                        <th className="p-2.5 pl-3 font-semibold text-muted-foreground w-12 text-center">Row</th>
                        <th className="p-2.5 font-semibold text-muted-foreground">Task Template Name</th>
                        <th className="p-2.5 font-semibold text-muted-foreground">Dept</th>
                        <th className="p-2.5 font-semibold text-muted-foreground text-center">Days</th>
                        <th className="p-2.5 pr-3 font-semibold text-muted-foreground text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row) => (
                        <tr key={row.rowNumber} className="border-b border-border/40 hover:bg-muted/20 transition-colors last:border-0">
                          <td className="p-2.5 pl-3 font-mono text-[11px] text-muted-foreground text-center">{row.rowNumber}</td>
                          <td className="p-2.5">
                            <div className="font-semibold text-foreground truncate max-w-[200px]" title={row.name}>
                              {row.name || <span className="text-destructive italic font-medium">Empty Name</span>}
                            </div>
                            {row.activity && <div className="text-[10px] text-muted-foreground">{row.activity}</div>}
                          </td>
                          <td className="p-2.5">
                            <span className="text-foreground/80">{row.deptName || <span className="text-destructive italic font-medium">Empty</span>}</span>
                          </td>
                          <td className="p-2.5 text-center font-mono font-semibold text-[11px]">
                            {row.defaultDurationDays === 0 ? "0 (Cont.)" : (row.defaultDurationDays !== null ? `${row.defaultDurationDays}d` : "-")}
                          </td>
                          <td className="p-2.5 pr-3 text-right">
                            {row.isValid ? (
                              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3.5 text-emerald-500" />
                                Ready
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-end">
                                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                  <AlertCircle className="size-3.5 text-rose-500" />
                                  Invalid
                                </span>
                                <span className="text-[9px] text-rose-500/80 max-w-[140px] truncate block" title={row.errors.join(", ")}>
                                  {row.errors[0]}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="shrink-0 px-5 py-3.5 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-9 px-4 text-xs cursor-pointer rounded-md"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImport}
            disabled={isUploading || validCount === 0}
            className="h-9 px-5 text-xs font-semibold gap-2 shadow-xs cursor-pointer rounded-md"
          >
            {isUploading ? (
              <>
                <RotateCw className="size-3.5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-3.5" />
                <span>Import {validCount} Templates</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
