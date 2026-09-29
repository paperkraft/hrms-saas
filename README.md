# Introduction

TODO: Give a short introduction of your project. Let this section explain the objectives or the motivation behind this project.

# Getting Started

REMOTE: The system disables geofencing. These employees are expected to work from anywhere, so they are never penalized or flagged for being "Outside Office."

HYBRID: The system maintains geofencing. It tracks whether the employee is at the office or at home. If a Hybrid employee punches in from the office, they are marked as Present. If they punch in from elsewhere, they are flagged as WFH.

OFFICE: Strict geofencing. Unlike Hybrid, if an Office worker punches in without sharing location or is off-site, they are automatically flagged with an "Outside Office" penalty.

# Backup and Restore

## Backup

```bash
npm run db:backup
```

## Restore

```bash
npm run db:restore
```

taskkill /PID 20112 /F

npx tsc --noEmit

npx tsx scripts/add-dummy-data.ts
npx tsx scripts/add-software-dummy-data.ts
npx tsx scripts/cleanup-milestone-logs.ts

npx tsx -r dotenv/config .\scripts\backfill_submitted_at.ts
npx tsx scripts/backfill_task_comment_type.ts

1. http://localhost:3000/api/system/migrate-urls

2. http://localhost:3000/api/system/migrate-attachments

3. npx tsx -r dotenv/config scripts/drop-legacy-attachments.ts

New-NetFirewallRule -DisplayName "MinIO FTP Passive Ports" -Direction Inbound -LocalPort 30000-30010 -Protocol TCP -Action Allow

New-NetFirewallRule -DisplayName "Open Port 2081" -Direction Inbound -LocalPort 2081 -Protocol TCP -Action Allow


Note: After running it, you just need to run npx prisma generate to refresh your Prisma Client, and you're fully migrated!

Create a dummy 50MB+ file (if you don't have one)
fsutil file createnew test-5mb.zip 5242880
fsutil file createnew test-10mb.zip 10485760
fsutil file createnew test-15mb.zip 15728640
fsutil file createnew test-20mb.zip 20971520
fsutil file createnew test-50mb.zip 52428800
fsutil file createnew test-100mb.zip 104857600
fsutil file createnew test-200mb.zip 209715200
fsutil file createnew test-500mb.zip 524288000

In industry standard project management (such as PMBOK or PRINCE2), a Milestone is defined as a point in time that marks a significant event or the completion of a major deliverable.

Here is how they usually differ from Tasks:

1. Duration (The Zero-Duration Rule)
   Technically, an industry-standard milestone has zero duration. It is a "gate" or a "flag" in the timeline. Therefore:

Tasks have a Start Date and an End Date (Work is being done).
Milestones usually only have a Target Date (A point has been reached). 2. Does it have a Start Date?
Strictly speaking, no. If something has a start and an end date, it is usually categorized as a Phase or a Task. However, in practical software/infrastructure projects:

Some people use "Milestone" to mean a Sprint or Version, which does have a date range.
Industry-leading tools (like Jira or MS Project) treat milestones as single dates, but they often track the Actual Completion Date vs the Planned Date.
Recommendations for your HRMS:
If you want to stick to the most common industry standards while keeping the UI clean:

Keep it as a single Target Date: This represents the deadline for that phase.
Add an "Actual Completion Date": When the TL/Admin marks it as "Completed", the system could record the current date. This allows you to report on whether the milestone was reached early or late.
Don't add a Start Date: Instead, the "Start Date" of a milestone is effectively the end date of the previous milestone (or the project start).

---

Currently, if there is a tie in the scores, here is how the system handles it:

1. Team Leader of the Month
   The system already has an explicit tie-breaker implemented in the sorting logic:

Primary sort: reviewEfficiency (higher efficiency wins).
First Tie-breaker: deptPunctuality (if review efficiency is equal, the team leader with the higher average team punctuality wins).
Second Tie-breaker (if both are equal): Falls back to the default database retrieval order (arbitrary/creation order). 2. Employee of the Month
Currently, the system only sorts by overallScore descending. In the event of a tie, it falls back directly to the default database retrieval order.

Would you like us to add explicit tie-breakers?
If so, here is a recommended tie-breaking hierarchy:

For Employees:

overallScore
avgRating (Higher average quality rating wins)
otsr (Higher on-time submission rate wins)
tcr (Higher task completion rate wins)
punctuality (Higher attendance/punctuality rate wins)
For Team Leaders:

reviewEfficiency
deptPunctuality (Team Punctuality)
avgDelayDays (Lower average delay days wins)

-------------------------- Leaves excluded -----------------------

Currently, approved leaves do not penalize or affect the punctuality rate.

How it works:
Attendance-Based: The punctuality rate is calculated strictly using the days the employee actually punched in (present days), which corresponds to the length of their Attendance records (userAttendance.length).
Exclusion of Leaves: On days when an employee is on approved leave, they do not punch in. Consequently, there is no attendance record for those days.
No Penalty: Because leave days do not generate attendance records, they are excluded from both:
The denominator (total present days)
The numerator (present days without late marks)
For example, if an employee works 18 days in a month and takes 4 approved leaves (so they don't punch in for those 4 days):

The punctuality rate is calculated based only on the 18 days they punched in.
If they were late on 2 of those days, their punctuality is $\frac{18 - 2}{18} \times 100% = 88.9%$, completely ignoring the 4 days they were on leave.

---------------------------Industry Standard Tie-Breaker Logic-----------------------

In performance evaluation, tie-breakers usually cascade from Quality → Reliability → Volume. If two employees have the exact same Overall Score, the tie is broken by looking at who achieved that score most efficiently and accurately.

The standard cascade looks like this:

1. Quality / Accuracy (FTR & Avg Rating): Between two tied employees, the one who made fewer mistakes (Higher FTR) or had better quality (Avg Rating) wins. Quality is always the strongest tie-breaker.
2. Reliability (OTSR): If quality is identical, who met deadlines more consistently?
3. Workload Volume (TCR / Total Tasks): If they are equally accurate and equally reliable, the tie goes to the person who carried a heavier workload.
4. Punctuality: Finally, basic attendance/punctuality.
   Right now, your system uses Avg Rating -> OTSR -> TCR -> Punctuality ONLY for selecting the "Employee of the Month". However, the actual Rankings Table falls back to Joining Date immediately after the Overall Score.

npx tsx -e "import 'dotenv/config'; import { minioClient } from './src/lib/minio'; async function main() { for (const bucket of ['library', 'hrms']) { try { await (minioClient as any).makeRequestAsyncOmit({ method: 'DELETE', bucketName: bucket, query: 'cors' }, '', [204], ''); console.log('Deleted CORS for: ' + bucket); } catch (e: any) { console.log('Error for ' + bucket + ': ' + e.message); } } } main();"
