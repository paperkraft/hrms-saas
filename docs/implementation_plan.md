# Implementation Plan — Employee & TL Performance Evaluation (with Attendance Factors)

We will implement an industry-standard performance and progress evaluation system for employees and Team Leaders (TLs), integrating task metrics, ratings, and attendance/punctuality.

---

## User Review Required

### Punctuality & Attendance Integration (Monthly)
We calculate each employee's monthly **Punctuality Rate** using attendance records from the start of the current calendar month:
- **Punctuality Formula**: 
  $$\text{Punctuality \%} = \frac{\text{Total Present Days (Current Month)} - \text{Actual Late Days (Current Month)}}{\text{Total Present Days (Current Month)}} \times 100\%$$
  where $\text{Actual Late Days} = \text{Late Punches} - \text{Waived Special Cases}$.
- **Overall Score Formula (with Ratings)**:
  $$\text{Overall Score} = (0.35 \times \text{OTSR}) + (0.25 \times \text{TCR}) + (0.20 \times \text{Punctuality}) + \left(0.20 \times \frac{\text{Average Rating}}{5} \times 100\right)$$
- **Overall Score Formula (without Ratings)**:
  $$\text{Overall Score} = (0.45 \times \text{OTSR}) + (0.35 \times \text{TCR}) + (0.20 \times \text{Punctuality})$$

### TL Evaluation & Leadership (Monthly)
For Team Leaders, in addition to Review Efficiency, we calculate:
- **Department Punctuality Rate**: The average punctuality rate of all members in their department for the current calendar month:
  $$\text{Dept Punctuality \%} = \frac{\sum_{i=1}^{N} \text{Punctuality \% of member } i}{N}$$
  where $N$ is the number of members in the department.
- **Review Efficiency Score**: Evaluates review delays:
  $$\text{Review Efficiency \%} = \max(0, 100 - (\text{Overdue Reviews} \times 10) - \text{Round}(\text{Average Delay Days} \times 2))$$

---

## Proposed Changes

### Backend Logic (Server Actions)

#### [MODIFY] [dashboard.ts](file:///d:/Sigma/hrms/src/actions/dashboard.ts)
- Update `getAdminReportsData` to:
  1. Fetch all `EMPLOYEE` and `ACCOUNTANT` users, along with their departments and attendance records for the last 30 days (filtering specifically from the start of the current month for monthly calculations).
  2. Fetch all departments and their designated Team Leaders.
  3. Fetch tasks created in the current calendar month (`createdAt >= startOfThisMonth`) with assignee and activity logs.
  4. Compute **Employee Performance Metrics** (monthly):
     - **TCR (Task Completion Rate)**: $\frac{\text{Completed Tasks} + \text{In Review Tasks}}{\text{Total Assigned Tasks}} \times 100\%$ (tasks created in current month).
     - **OTSR (On-Time Submission Rate)**: Percentage of completed or in-review tasks that were submitted *before or on* the deadline (using the `activityLogs` to find the exact submission timestamp, or falling back to `updatedAt`/`actualEnd`).
     - **Punctuality %**: Percentage of present days where the employee arrived on time (not late, or late was waived as a special case) during the current month.
     - **Average Rating**: Average of TL and Admin ratings.
     - **Overall Score**: Weighted score based on OTSR, TCR, Punctuality, and Quality Rating.
     - **Performance Grade**: Grade mapping (Excellent, Very Good, Good, Satisfactory, Needs Improvement).
  5. Compute **TL Review Efficiency & Leadership Metrics** (monthly):
     - **Pending Reviews**: Tasks currently in `IN_REVIEW`.
     - **Overdue Reviews**: Tasks in `IN_REVIEW` where the deadline (`plannedEnd`) has passed (attributed to the TL).
     - **Average Delay Days**: Average number of days overdue reviews have been sitting in the queue:
       $$\text{Average Delay Days} = \frac{\sum \text{Days Overdue}}{\text{Number of Overdue Reviews}}$$
     - **Review Efficiency Score**: Calculated using the penalty formula (10 points per overdue review, 2 points per average delay day).
     - **Dept Punctuality**: Average punctuality rate of all department members for the current month.
  6. Return `employeePerformance` and `tlPerformance` data structures to the client.

### Frontend UI (Reports Client)

#### [MODIFY] [reports-client.tsx](file:///d:/Sigma/hrms/src/components/features/admin/reports-client.tsx)
- Update `AdminReportsClient` to:
  1. Accept `employeePerformance` and `tlPerformance` as optional props.
  2. Implement a view state (`"operations" | "performance"`) with a sleek horizontal navigation toggle at the top of the page.
  3. Render a tab panel for **Employee & Manager Performance Evaluation**:
     - **Search Bar**: Let admins filter evaluations by employee name or department.
     - **Employee Performance Rankings Grid**:
       - Standard high-density table displaying: Employee Name, Department, Total Tasks, TCR %, OTSR %, Punctuality %, Average Rating, Overall Score, and Grade badge.
       - Progress bars for TCR, OTSR, and Punctuality.
       - Grade badges styled with harmonious semantic colors (e.g. green for Excellent, red for Needs Improvement).
     - **Team Leader (TL) Review Queue & Efficiency Grid**:
       - Table displaying: TL Name, Department, Pending Reviews, Overdue Reviews, Avg Delay Days, Review Efficiency, and Team Punctuality %.
       - Overdue reviews highlighted in amber/red.
       - Circular or linear gauges for Review Efficiency and Team Punctuality.

#### [MODIFY] [admin-dashboard-client.tsx](file:///d:/Sigma/hrms/src/components/features/dashboard/admin-dashboard-client.tsx)
- Pass the newly calculated `employeePerformance` and `tlPerformance` datasets from `initialReports` to the `AdminReportsClient` component.

---

## Verification Plan

### Manual Verification
1. Navigate to the Admin Dashboard and select the **Reports & Analytics** tab.
2. Verify that a new toggle option is available to switch between **Operations** and **Performance**.
3. Select **Performance** and verify that the Employee Performance Grid loads correctly.
4. Verify that the **Punctuality %** column is displayed with correct percentages calculated from late/on-time attendance logs.
5. Verify that Employee "Rahul Kumar" or "Amruta Kale" is not penalized for delayed tasks currently in the `IN_REVIEW` queue (if they submitted it on time).
6. Verify that Team Leaders have a calculated Review Efficiency Score showing the impact of any overdue `IN_REVIEW` tasks they are holding.
7. Verify the search filter works for name and department.
