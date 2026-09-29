import jsPDF from "jspdf";
import { RobotoRegular, RobotoBold } from "./fonts";
import { appConfig } from "@/lib/app-config";

export async function generateCTC(formData: any, userName: string, empCode: string, designation: string) {
  const doc = new jsPDF({ compress: true });

  doc.addFileToVFS("Roboto-Regular.ttf", RobotoRegular);
  doc.addFileToVFS("Roboto-Bold.ttf", RobotoBold);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  const grossSalary = Number(formData.grossSalary) || 0;
  const basic = Number(formData.basic) || 0;
  const hra = Number(formData.hra) || 0;
  const conveyance = Number(formData.conveyance) || 0;
  const consolidated = Number(formData.consolidated) || 0;
  const medical = Number(formData.medical) || 0;
  const childEdu = formData.hasChildrenAllowance ? Math.round(grossSalary * 0.05) : 0;
  const childHostel = formData.hasChildrenAllowance ? Math.round(grossSalary * 0.05) : 0;

  // A) Monthly salary subtotal
  const subTotalA_Monthly = basic + hra + conveyance + consolidated + medical + childEdu + childHostel;
  const subTotalA_Annually = subTotalA_Monthly * 12;

  // B) Provident Fund (Employer)
  const configuredPF = Number(formData.providentFund) || 0;
  const pfEmployer_Monthly = configuredPF > 0 ? configuredPF : Math.round(Math.min(basic, 15000) * 0.12);
  const pfEmployer_Annually = pfEmployer_Monthly * 12;

  // C) ESIC (Employer)
  const configuredESIC = Number(formData.esic) || 0;
  const esicEmployer_Monthly = configuredESIC > 0 ? configuredESIC : (basic <= 21000 ? Math.round(basic * 0.0325) : 0);
  const esicEmployer_Annually = esicEmployer_Monthly * 12;

  // D) Bonus
  const bonus_Annually = Number(formData.annualBonus) || 0;

  // E) Total
  const total_Annually = subTotalA_Annually + pfEmployer_Annually + esicEmployer_Annually + bonus_Annually;

  // 0. Light Background for the entire page
  doc.setFillColor(255, 255, 255); // White Background
  doc.rect(0, 0, 210, 297, 'F');

  // Colors
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
  doc.text("ANNUAL COMPENSATION STRUCTURE", 105, 42, { align: "center" });

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
  drawInfo("Employee Name", userName || "N/A", 15, lY); lY += 6.5;
  drawInfo("Designation", designation || "N/A", 15, lY); lY += 6.5;
  drawInfo("Employee Code", empCode || "N/A", 15, lY); lY += 6.5;

  // 3. Table Header
  const tblY = lY; // Start after info grid
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.line(15, tblY, 195, tblY);

  doc.setFont("Roboto", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(9);

  doc.text("DESCRIPTION", 15, tblY + 6);
  doc.text("MONTHLY", 110, tblY + 6, { align: "right" });
  doc.text("ANNUALLY", 195, tblY + 6, { align: "right" });

  doc.line(15, tblY + 10, 195, tblY + 10);

  const formatAmt = (num: number) => num > 0 ? num.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-';

  let currY = tblY + 10;
  const rowHeight = 8;

  const drawRow = (label: string, monthlyStr: string, annualStr: string, isBold: boolean, isSectionHeader: boolean) => {
    doc.setFontSize(isSectionHeader ? 10 : 10);

    if (isBold) {
      doc.setFont("Roboto", "bold");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
    } else {
      doc.setFont("Roboto", "normal");
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
    }

    doc.text(label, 15, currY + 6);

    if (monthlyStr !== "") doc.text(monthlyStr, 110, currY + 6, { align: "right" });
    if (annualStr !== "") doc.text(annualStr, 195, currY + 6, { align: "right" });

    currY += rowHeight;
    doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
    doc.line(15, currY, 195, currY);
  };

  const drawSpacer = () => {
    currY += 3;
  };

  // --- A) Monthly salary ---
  drawRow("A) Monthly salary", "", "", true, true);
  drawRow("Basic Salary", formatAmt(basic), formatAmt(basic * 12), false, false);
  drawRow("Housing Rent Allowance", formatAmt(hra), formatAmt(hra * 12), false, false);
  drawRow("Conveyance Allowance", formatAmt(conveyance), formatAmt(conveyance * 12), false, false);
  drawRow("Consolidated Allowance", formatAmt(consolidated), formatAmt(consolidated * 12), false, false);
  drawRow("Medical Allowance", formatAmt(medical), formatAmt(medical * 12), false, false);
  if (childEdu > 0) drawRow("Child Education Allowance", formatAmt(childEdu), formatAmt(childEdu * 12), false, false);
  if (childHostel > 0) drawRow("Child Hostel Allowance", formatAmt(childHostel), formatAmt(childHostel * 12), false, false);
  drawRow("Sub-Total (A)", formatAmt(subTotalA_Monthly), formatAmt(subTotalA_Annually), true, false);
  drawSpacer();

  // --- B) Company Contributions ---
  drawRow("B) Company Contributions", "", "", true, true);
  drawRow("Provident Fund", formatAmt(pfEmployer_Monthly), formatAmt(pfEmployer_Annually), false, false);
  drawRow("ESIC", formatAmt(esicEmployer_Monthly), formatAmt(esicEmployer_Annually), false, false);
  drawRow("Bonus", "-", formatAmt(bonus_Annually), false, false);
  drawSpacer();

  // --- C) Total ---

  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text("C) Total Cost to Company (CTC)", 15, currY + 6);
  doc.text(formatAmt(total_Annually), 195, currY + 6, { align: "right" });
  currY += rowHeight;
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.line(15, currY, 195, currY);
  drawSpacer();

  // --- D) Deductions ---
  drawRow("D) Deductions", "", "", true, true);
  drawRow("Professional Tax", "As applicable", "As applicable", false, false);
  drawRow("Provident Fund (Employee contribution)", "As applicable", "As applicable", false, false);
  drawRow("Income Tax / TDS", "As applicable", "As applicable", false, false);

  currY += 6;

  // Notes Block
  doc.setDrawColor(borderLight.r, borderLight.g, borderLight.b);
  doc.rect(15, currY, 180, 26); // subtle border

  doc.setFontSize(9);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text("Notes :", 20, currY + 6);

  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(textGray.r, textGray.g, textGray.b);
  doc.text("i) Standard deductions like P.F., ESIC, I.T., Proff. Tax, etc. applicable as per government norms and may vary as per actual workdays.", 20, currY + 12);
  doc.text("ii) Traveling to outstation for company work - actual traveling, lodging and boarding will be reimbursed as per company rules.", 20, currY + 18);


  return doc;
}
