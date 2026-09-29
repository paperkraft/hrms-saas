import jsPDF from "jspdf";
import { RobotoRegular, RobotoBold } from "./fonts";
import { appConfig } from "@/lib/app-config";

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num > 999999999) return 'Amount Too Large';

  const numStr = ('000000000' + num).slice(-9);
  const n = numStr.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  const parsePart = (val: string) => {
    const v = Number(val);
    if (v === 0) return '';
    if (v < 20) return a[v];
    return b[Number(val[0])] + (val[1] !== '0' ? ' ' + a[Number(val[1])] : '');
  };

  if (n[1] !== '00') str += parsePart(n[1]) + ' Crore ';
  if (n[2] !== '00') str += parsePart(n[2]) + ' Lakh ';
  if (n[3] !== '00') str += parsePart(n[3]) + ' Thousand ';
  if (n[4] !== '0') str += parsePart(n[4]) + ' Hundred ';
  if (n[5] !== '00') str += ((str !== '') ? 'and ' : '') + parsePart(n[5]);

  return str.trim() + ' Only';
}

export async function generateSalarySlip(record: any, monthName: string, year: number) {
  const doc = new jsPDF({ compress: true });

  doc.addFileToVFS("Roboto-Regular.ttf", RobotoRegular);
  doc.addFileToVFS("Roboto-Bold.ttf", RobotoBold);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  const userName = record.user?.name || "Employee";
  const empCode = record.user?.employeeCode || "N/A";

  const presentDays = Math.max(0, record.presentDays || 0);
  const lopDays = Math.max(0, record.unpaidLeave || record.lwpDays || 0);

  // 0. Light Background for the entire page
  doc.setFillColor(255, 255, 255); // White Background
  doc.rect(0, 0, 210, 297, 'F');

  // Colors
  const primaryLight = { r: 245, g: 243, b: 255 }; // Faint Purple
  const borderLight = { r: 229, g: 231, b: 235 }; // Gray 200
  const textDark = { r: 30, g: 30, b: 30 }; // Almost black
  const textGray = { r: 100, g: 100, b: 100 }; // Gray text

  // 1. Letterhead Top
  doc.setFont("Roboto", "bold");
  doc.setFontSize(18);
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text(appConfig.companyFullName, 105, 20, { align: "center" });

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(appConfig.companyAddress, 105, 26, { align: "center" });

  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.line(15, 32, 195, 32);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text(`SALARY SLIP - ${monthName.toUpperCase()} ${year}`, 105, 42, { align: "center" });

  // 2. Employee Info Section
  const drawInfo = (label: string, value: string, x: number, y: number) => {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(label, x, y);
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.setFont("Roboto", "bold");
    doc.text(value, x + 35, y);
  };

  let lY = 52;
  drawInfo("Employee Name", userName, 15, lY); lY += 6.5;
  drawInfo("Designation", record.user?.designation || "N/A", 15, lY); lY += 6.5;
  drawInfo("Employee Code", empCode, 15, lY); lY += 6.5;
  drawInfo("Present Days", presentDays.toString(), 15, lY); lY += 6.5;
  drawInfo("LOP Days", lopDays.toString(), 15, lY);

  let rY = 52;
  drawInfo("Bank Name", record.user?.salaryStructure?.bankName || "N/A", 110, rY); rY += 6.5;
  drawInfo("Account No", record.user?.salaryStructure?.accountNumber || "N/A", 110, rY); rY += 6.5;
  drawInfo("PAN No", record.user?.salaryStructure?.panNumber || "N/A", 110, rY); rY += 6.5;
  drawInfo("PF No", record.user?.salaryStructure?.pfAccountNumber || "N/A", 110, rY); rY += 6.5;

  // 3. Table Header
  const tblY = Math.max(lY, rY) + 12; // Start after info grid
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.line(15, tblY, 195, tblY);

  doc.setFont("Roboto", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(9);

  doc.text("EARNINGS", 15, tblY + 6);
  doc.text("AMOUNT", 95, tblY + 6, { align: "right" });

  doc.text("DEDUCTIONS", 110, tblY + 6);
  doc.text("AMOUNT", 195, tblY + 6, { align: "right" });

  doc.line(15, tblY + 10, 195, tblY + 10);

  // Content arrays
  const earnings = [
    { label: "Basic", value: Math.max(0, record.basic || 0) },
    { label: "House Rent Allowance", value: Math.max(0, record.hra || 0) },
    { label: "Conveyance Allowance", value: Math.max(0, record.conveyance || 0) },
    { label: "Consolidated Allowance", value: Math.max(0, record.consolidated || 0) },
    { label: "Medical Allowance", value: Math.max(0, record.medical || 0) },
    { label: "Child Education Exemption", value: Math.max(0, record.childrenEducation || 0) },
    { label: "Child Hostel Exemption", value: Math.max(0, record.childrenHostel || 0) },
    { label: "Reimbursement", value: Math.max(0, record.reimbursement || 0) },
    { label: "Allowance", value: Math.max(0, record.allowance || 0) },
    { label: "Annual Bonus", value: Math.max(0, record.bonus || 0) }
  ].filter(e => e.value > 0 || e.label === "Basic");

  const deductions = [
    { label: "Professional Tax", value: Math.max(0, record.professionalTax || 0) },
    { label: "Provident Fund", value: Math.max(0, record.providentFund || 0) },
    { label: "Insurance / Advance", value: Math.max(0, record.advance || 0) },
    { label: "ESIC", value: Math.max(0, record.esic || 0) }
  ].filter(d => d.value > 0);

  const maxRows = Math.max(earnings.length, deductions.length);
  const rowHeight = 8;
  let currY = tblY + 10;

  // Table Rows
  for (let i = 0; i < maxRows; i++) {
    doc.setFontSize(10);

    // Earnings
    if (i < earnings.length) {
      doc.setFont("Roboto", "normal");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(earnings[i].label, 15, currY + 6);
      doc.setFont("Roboto", "bold");
      doc.text(`Rs.${earnings[i].value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 95, currY + 6, { align: "right" });
    }

    // Deductions
    if (i < deductions.length) {
      doc.setFont("Roboto", "normal");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.text(deductions[i].label, 110, currY + 6);
      doc.setFont("Roboto", "bold");
      doc.text(`Rs.${deductions[i].value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 195, currY + 6, { align: "right" });
    }

    currY += rowHeight;
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.line(15, currY, 195, currY);
  }

  // 4. Gross Row inside table
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);

  const safeSubAdd = Math.max(0, record.subtotalAdditions || 0);
  const safeSubDed = Math.max(0, record.subtotalDeductions || 0);

  doc.text("GROSS EARNINGS", 15, currY + 6);
  doc.text(`Rs.${safeSubAdd.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 95, currY + 6, { align: "right" });

  doc.text("TOTAL DEDUCTIONS", 110, currY + 6);
  doc.text(`Rs.${safeSubDed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 195, currY + 6, { align: "right" });

  currY += rowHeight;
  doc.line(15, currY, 195, currY);

  currY += 10;

  // 5. Net Payable Block
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.rect(15, currY, 180, 32); // subtle border

  doc.setFont("Roboto", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);

  doc.setFontSize(10);
  doc.text("TOTAL NET PAYABLE", 25, currY + 10);

  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(textGray.r, textGray.g, textGray.b);
  doc.text("Gross Earnings - Total Deductions", 25, currY + 16);

  const safeNet = Math.max(0, record.netSalary || 0);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(24);
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text(`Rs.${safeNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 185, currY + 14, { align: "right" });

  // Amount in words inside the block
  doc.setFontSize(9);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text("Amount in words: ", 25, currY + 26);

  const numStr = numberToWords(safeNet);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(textGray.r, textGray.g, textGray.b);
  doc.text(`Indian Rupee ${numStr}`, 55, currY + 26, { maxWidth: 130 });

  currY += 42;

  // 6. Footer
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.line(15, 280, 195, 280);

  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("System generated - No signature required", 105, 287, { align: "center" });

  return doc;
}
