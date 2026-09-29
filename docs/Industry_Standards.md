# Team of the Month & Year

This plan details the implementation of a new "Team of the Month" and "Team of the Year" feature to complement the existing Star Employee and Top Leader awards.

## Proposed Changes

### 1. Backend Calculations (`d:\Sigma\hrms\src\actions\dashboard.ts`)
We will add a new `teamPerformance` calculation to both the Monthly and Yearly reporting logic.

The backend will:
1. Group all `employeePerformance` records by their `department`.
2. Calculate the average `overallScore` across all employees in that department.
3. Factor in the department's Team Leader's score (if applicable) for a final Team Score.
4. Calculate the team's average Productivity, Timeliness, Quality, and Discipline to display in the reports.
5. In `getMonthlyChampions`, calculate and return the `liveTeam` and `prevTeam` winners (the department with the highest average team score).

### 2. Dashboard Widget (`d:\Sigma\hrms\src\components\features\dashboard\champions-widget.tsx`)
We will update the **Wall of Fame** widget to display three distinct categories:
- Star Employee
- Top Leader
- **Top Team** (Displaying the Department Name, an icon, and their average team score).

### 3. Reports Interface (`d:\Sigma\hrms\src\components\features\admin\reports-client.tsx`)
We will update the Admin Reports UI so administrators can view the new team metrics:
- Add a new "Team Performance" grid/table that lists every department, their average 4-pillar metrics, and their overall Team Score.
- Update the export buttons to allow exporting the new Team Performance report.

## Open Questions

> [!IMPORTANT]
> How should the "Team Score" be calculated? 
> **Option A (Recommended)**: Simple average of all employees' overall scores in that department.
> **Option B**: Average of employees' scores + the Team Leader's score blended together (e.g. 80% team average, 20% TL score).
> 
> Let me know your preference and I will proceed with execution!
