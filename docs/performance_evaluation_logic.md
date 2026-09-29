# HRMS Performance Evaluation Logic & Methodology

This document outlines the mathematical foundation behind the Monthly and Yearly performance scoring in the HRMS application.

## 1. The 4-Pillar Scoring Formula
Every employee is graded on a strict 100-point scale distributed across four pillars. The final score formula is exactly the same for both Monthly and Yearly evaluations:

> **Overall Score** = (Productivity × 30%) + (Timeliness × 25%) + (Quality × 25%) + (Discipline × 20%)

### Task Weighting (Duration × Priority)
Tasks are NOT simply counted as "1 task". They are weighted to ensure complex, critical work is valued more than simple work.
* **Duration:** A 10-day task is worth 10 points. A 1-day task is worth 1 point.
* **Priority Multiplier:** URGENT/HIGH = 1.5x | MEDIUM = 1.0x | LOW = 0.75x
* **Example:** A 10-day HIGH priority task carries a weight of `15`. A 2-day LOW priority task carries a weight of `1.5`. 

---

## 2. The 4 Pillars Explained

### Pillar 1: Productivity (30%)
**"Did you deliver what was actually due, and did you do enough volume?"**
* **Formula:** `Delivered Weight / Max(Due Weight, Department Baseline)`
* **Department Baseline:** To prevent an employee from doing exactly 1 tiny task and getting a 100% productivity score, the system calculates the average delivered weight of the entire department. You are judged against your assigned workload OR the department average—whichever is higher.
* *Note:* Future tasks do not penalize you. The system only looks at tasks where the deadline has passed, or tasks you have already submitted.

### Pillar 2: Timeliness (25%)
**"Of the submitted tasks that had deadlines, how many were submitted on time?"**
* **Formula:** `On-Time Weight / Submitted Deadline Weight`
* *Note:* If a task has no deadline assigned, it is automatically counted as "On-Time" to prevent unfair penalization.

### Pillar 3: Quality (25%)
**"How well was the work done?"**
* **Formula:** `(Average Rating × 85%) + (First-Time-Right Acceptance × 15%)`
* **Ratings:** The system converts 1-5 star ratings from TLs/Admins into a percentage (e.g., 5 stars = 100%, 4 stars = 80%).
* **Acceptance:** If a task was rejected with "❌ REJECTED" in the comments, it lowers the acceptance rate. 
* *Note:* If a task has not been rated yet, it defaults to a neutral 60% to prevent it from dragging scores to 0.

### Pillar 4: Discipline (20%)
**"How reliable is your attendance?"**
* **Formula:** `(Total Present Days - Actual Late Days) / Total Present Days`

---

## 3. Monthly vs Yearly Differences

While the formula is identical, applying it to a 30-day window vs a 365-day window naturally creates statistical differences. 

### A. The "Tortoise and the Hare" Phenomenon
* **The Scenario:** Employee A wins Month 1 with 98% but slacks off in Month 2 with 60%. Employee B never wins, but scores a consistent 90% in both months.
* **The Result:** Employee B will win Employee of the Year. 
* **Why?** The Yearly score is **not** an average of monthly scores. It is a fresh calculation of all tasks across the entire year. Employee B's consistent high volume and quality will mathematically beat out Employee A's short-term spike.

### B. The "Month-Boundary" Penalty
If a task spans across multiple months, the Monthly reports can sometimes "double-penalize" an employee, whereas the Yearly report corrects this.

* **Example:** A task is due in **May**, but the employee misses the deadline and finally submits it late in **June**.
* **May Monthly Report:** The system sees the deadline passed without submission. Timeliness is penalized in May.
* **June Monthly Report:** The system sees the task was finally submitted, but it was submitted late. Timeliness is penalized *again* in June.
* **Yearly Report:** The Yearly system grabs the task, evaluates it exactly **once**, and applies the late penalty exactly **once**. 
* **The Result:** The employee's Yearly Timeliness score will often be higher and more accurate than the average of their Monthly Timeliness scores because the artificial 30-day "calendar cuts" have been removed.

---

## 4. Confidence Indicator
In the UI, you will see a colored dot next to an employee's total task count:
* 🟢 **High (Green):** 5+ tasks. The score is highly reliable.
* 🟡 **Medium (Yellow):** 3-4 tasks. The score is decent but vulnerable to a single bad task.
* 🔴 **Low (Red):** 1-2 tasks. The score mathematically exists but the sample size is too small for major decisions.
