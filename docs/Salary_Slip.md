# Salary Slip Formula Refactoring

This plan outlines the steps to refactor the payroll generation logic to match your new formula, which dynamically derives all components (Basic, HRA, PF, PT, ESIC, etc.) from a single Current Monthly Salary (CMS) input, rather than relying on manually entered fixed components.

## ⚠️ User Review Required
Please review the open questions below to clarify the new requirements before we proceed with the code changes.

> [!WARNING]
> **Conflict with Previous Logic**: The new formula for Time Factor is `present_days / total_working_days`. This completely overrides the previous logic we just built which determined Time Factor based on the employee's average daily working hours (e.g. 0.5 for 4-6 hours, 1.0 for 8 hours). Do you want to **completely replace** the hour-based logic with the new `present_days / total_working_days` formula, or do you want to use the hour-based time factor in this new formula?

> [!IMPORTANT]
> **Total Working Days**: How should we calculate `total_working_days`? Should it be simply the total number of days in that specific month (e.g., 31 for Jan, 28/29 for Feb), or should it exclude weekends and public holidays? 

> [!IMPORTANT]
> **Current Monthly Salary (CMS)**: To supply the CMS for each employee, we can just repurpose the existing "Gross Monthly" calculation in the Payroll Settings table. Essentially, the accountant will input a single total "Gross Salary" number for the employee, and the system will auto-calculate Basic, HRA, Conveyance, Medical, etc. Is this the preferred approach?

> [!IMPORTANT]
> **Manual Inputs (Reimbursement & Advance/Insurance)**: You mentioned that reimbursement and advance/insurance are manual. Since these often change month-to-month, would you like me to add inline editable fields for **Reimbursement** and **Advance/Insurance** directly on the **Payroll Generation** table (similar to how you can edit Time Factor)?

## Proposed Changes

### 1. `src/actions/payroll.ts`
We will rewrite `generateMonthlyPayroll`:
- Replace the static component lookups with dynamic calculations based on the employee's CMS.
- Implement the `total_working_days` calculation based on your feedback.
- Apply the new formula:
  - `time_factor = present_days / total_working_days` (pending clarification on hour-based logic)
  - `basic = CMS * 0.50 * time_factor`
  - `hra = basic * 0.50`
  - `conveyance = CMS * 0.10 * time_factor`
  - `consolidated = CMS * 0.10 * time_factor`
  - `medical = CMS * 0.05 * time_factor`
  - `gross_salary = basic + hra + conveyance + consolidated + medical`
  - `pf = min(basic, 15000) * 0.12`
  - `pt = 200` (if `gross_salary > 10000` else `0`)
  - `esic = gross_salary * 0.0075` (if `gross_salary <= 21000` else `0`)
  - `tds`, `insurance`, `reimbursement` pulled from manual entry.

### 2. `src/components/features/accountant/payroll-settings-table.tsx`
- We will update the configuration dialog. Instead of asking the accountant to type in Basic, HRA, Conveyance, PF, and PT, they will only need to input **Current Monthly Salary (CMS)**, **TDS**, and **Insurance/Advance**. The UI will display a live preview of the computed breakdown using the formula.

### 3. `src/components/features/accountant/payroll-master-table.tsx`
- We will add inline editable fields for `reimbursement` and `advance_or_insurance` directly on the generated payroll rows so accountants can tweak them on the fly for specific months.

## Verification Plan
1. We will generate the payroll for a sample employee.
2. We will manually calculate the formula using a calculator to ensure the app's output matches perfectly.
3. We will verify the PDF slip reflects the correct values.
