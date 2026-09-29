# Payroll Calculation Logic & Architecture

This document explains the mathematical formulas and logic used behind the scenes to generate monthly payroll ledgers and salary slips in the system.

## 1. The Time Math (Days & Hours)

* **Working Days:** The system dynamically calculates the exact number of working days in the specific calendar month by taking the total days in the month and subtracting Sundays (typically resulting in 26 or 27 days).
* **Unpaid Leaves (LOP):** The system queries the Attendance Ledger to count any `LWP` (Leave Without Pay) and unexplained "Missing Days".
* **Payable Days (Present):** Your `Working Days` minus `Unpaid Leaves`. *(Note: Approved Paid Leaves do not deduct from payable days).*

## 2. The Core Salary (Prorating)

Instead of calculating a full month's salary and subtracting a daily rate at the end, the system prorates the Gross Salary upfront mathematically.

* **Derived Gross:** The system takes the configured **CMS** (Current Monthly Salary), divides it by the month's Working Days to find the "Daily Rate", and multiplies it by the **Payable Days**.
  * `Derived Gross = (CMS / Working Days) * Payable Days`
* **Splitting the Pie:** Once the prorated Derived Gross is established, it is sliced into statutory components:
  * **Basic:** 50% of the Derived Gross
  * **HRA:** 50% of the Basic (which effectively is 25% of the Derived Gross)
  * **Children Allowances:** 5% each (only applied if enabled in the employee's Salary Structure)
  * **Remaining Pool:** The remainder (usually 25% if no children allowances exist) is split dynamically:
    * Conveyance (40% of the remainder)
    * Consolidated (40% of the remainder)
    * Medical (20% of the remainder)

## 3. Additions (Earnings)

* **Allowance:** For field staff, the system checks the Attendance Ledger for "Allowance Days" and automatically calculates: `Allowance Days × Rs. 350`. *(If an accountant manually overrides the Allowance on the generated table, the system locks their override and ignores this formula).*
* **Overtime (OT):** Evaluated by taking the Daily Rate, dividing by 8 to get an Hourly Rate, and multiplying by logged OT Hours.
* **Reimbursement:** This is a combination of three factors:
  * Overtime Pay
  * Encashed Leaves (`Encashed days * Daily rate`)
  * Manual Reimbursement overrides

## 4. Deductions

* **PF (Provident Fund):** Unless a fixed manual PF amount is set in the Salary Structure, the system auto-calculates 12% of the **Basic** salary. This deduction is capped at a maximum basic ceiling of Rs. 15,000.
* **ESIC:** If the calculated Basic is under Rs. 21,000, the system deducts **0.75%** of the Basic.
* **PT (Professional Tax):** A standard Rs. 200 deduction, subject to gender-based statutory limits:
  * Male employees pay PT if gross > 10,000
  * Female employees pay PT if gross > 26,000
* **Advance / Insurance:** Deducted directly based on the amount specified in the Payroll Settings or overridden manually in the monthly ledger.

## 5. Final Net Payable

The system aggregates the data to produce the final payout:
`Net Payable = (Prorated Core Salary + Additions) - Deductions`

### Important Note on Manual Overrides
The payroll generation engine uses a "lock-in" mechanic. If HR or an Accountant manually edits **Allowance**, **Reimbursement**, or **Advance** directly on a generated monthly table, the system registers an `existingRecord` state. If the "Generate Payroll" button is clicked again, the engine will recalculate taxes and basic components but will **preserve and lock in** those manual overrides for that specific month.
