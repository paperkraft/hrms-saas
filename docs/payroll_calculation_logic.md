# Payroll Calculation & Taxation Logic

This document outlines the standard payroll mathematics implemented in the HRMS, which aligns with enterprise systems like Zoho Payroll, Keka, and RazorpayX.

## 1. The "Total Payable Days" Formula

The system uses the **Loss of Pay (LOP)** method to calculate payable days. It starts from the expected Working Days and subtracts absences, rather than adding up present days.

> [!IMPORTANT]
> **Total Payable Days = Working Days - Missing (No Punch) - LWP (Unpaid Leaves) + Encashable Days + Extra Days (Off Days)**

### Why use Working Days instead of Present Days?
If an employee takes an Unpaid Leave (LWP), their **Present Days** automatically decreases because they didn't punch in. If the system calculated salary as `Present Days - LWP`, the employee would be **double-deducted** for the same absence. 

By starting with the fixed **Working Days** and subtracting the LWP, the math is perfectly balanced and guarantees no double deductions.

---

## 2. Payout Strategy: Additions vs. Base Salary

Even though the frontend dashboard combines all days into a single "Total Payable" number for quick viewing, the backend payroll engine separates these components strictly for legal compliance.

### A. Prorated Base Salary
The core salary components (Basic, HRA, Conveyance) are prorated strictly against regular working days:
`Payable Base Days = Working Days - LWP - Missing`

### B. Auto-Reimbursements (Additions)
Extra earnings are **not** added to the Base Salary days. Instead, their monetary equivalent is calculated and added as a non-taxable (for PF) reimbursement:
`Extra Payout = (Daily Gross Salary) × (Encashable Days + Extra Days Worked)`

---

## 3. Statutory Taxation on Extra Days

How are Extra Days (Sundays, Holidays) and Leave Encashments handled under Indian Tax Laws?

> [!WARNING]
> **Income Tax (TDS): FULLY TAXABLE**
> Any money earned from Extra Days or Leave Encashment falls under "Income from Salary" and is added to the employee's gross annual income. If their income crosses the tax threshold, this money is subject to standard TDS.

> [!TIP]
> **Provident Fund (PF) & ESIC: EXEMPT (Usually)**
> Under the EPF Act, Provident Fund is legally calculated only on the core **Basic Salary + Dearness Allowance**. 
> Money earned from working on off-days, overtime, or leave encashments is generally excluded from PF calculations.

Because our HRMS pays out Extra Days as a separate **Reimbursement** rather than inflating the Base Salary, the system ensures that **PF is never illegally deducted** from off-day earnings, keeping the company 100% compliant.
