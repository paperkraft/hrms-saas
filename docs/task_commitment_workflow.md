# Task Commitment Workflow — Design Specification (v3 / Final)

## The Philosophy

| Principle | Implementation |
|-----------|---------------|
| Final authority stays with TL/Admin | Employees cannot block work — only surface concerns |
| Soft warnings, not hard blocks | ⚠️ Capacity alert at 90%+ but assignment still proceeds |
| No silent actions | Every response requires a comment, timestamp, and audit log |
| Communication is structured, not noisy | Mini-thread per task — not a general chat |
| Workload is visible before decisions | TL sees capacity data *before* clicking Assign |

---

## The Full Lifecycle

```
[TL opens "Assign Task" dialog]
            ↓
  ┌─ Workload Intelligence Panel ────────────────────┐
  │  Rahul Kumar                                      │
  │  Active Tasks: 8   Estimated Load: 46h            │
  │  Overdue: 2        Capacity: 120% ⚠️              │
  │                                                   │
  │  Priya Sharma                                     │
  │  Active Tasks: 3   Estimated Load: 18h            │
  │  Overdue: 0        Capacity: 45% ✅               │
  └───────────────────────────────────────────────────┘
            ↓
  TL selects assignee → if capacity > 90%:
  ⚠️ "Rahul's workload exceeds 90%. Still assign?"
  [Assign Anyway]  [Choose Someone Else]
            ↓
        PROPOSED
  Employee notified with: task details, priority,
  deadline, estimated hours, their own workload
            ↓
  ┌──────────────────────────────────────────────┐
  │           Employee Response                   │
  ├──────────────┬───────────────────────────────┤
  │ ✅ ACCEPT   │ 💬 REQUEST REASSIGNMENT        │
  │ (+ comment) │    or RAISE WORKLOAD CONCERN   │
  │             │    (+ reason + comment)         │
  └──────────────┴───────────────────────────────┘
            ↓                    ↓
       COMMITTED             NEGOTIATING
            ↓                    ↕ ↕ ↕
       [Kanban]             TL reviews concern
        TODO →              → Adjust & keep
        IN_PROGRESS         → Reassign to someone
        IN_REVIEW           → Force-commit (logged)
        COMPLETED
```

---

## Feature 1 — Workload Intelligence (Pre-Assignment)

When a TL opens the task assignment dialog, they see a live capacity panel for eligible assignees:

```
┌─ Team Capacity ─────────────────────────────────────────┐
│                                                          │
│  👤 Rahul Kumar                                          │
│     Active Tasks: 8   ·   Est. Load: ~46h               │
│     Overdue: 2         ·   Capacity: 120% ████████ ⚠️   │
│                                                          │
│  👤 Priya Sharma                                         │
│     Active Tasks: 3   ·   Est. Load: ~18h               │
│     Overdue: 0         ·   Capacity: 45%  ███░░░░░ ✅   │
│                                                          │
│  👤 Arjun Mehta                                          │
│     Active Tasks: 5   ·   Est. Load: ~28h               │
│     Overdue: 1         ·   Capacity: 70%  █████░░░ ✅   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Capacity formula:**
```
Capacity % = (sum of remaining plannedDuration across active/committed tasks)
             ÷ (standard work hours per week, e.g. 40h)
             × 100
```

**Color coding:**
- 0–75% → ✅ Green
- 76–90% → 🟡 Yellow (caution)
- 91–110% → ⚠️ Orange (soft warning)
- 111%+ → 🔴 Red (overloaded)

### Soft Warning (Not a Hard Block)
When TL selects an assignee at 90%+:

```
⚠️ Rahul Kumar's workload is at 120%.
   Active Tasks: 8  ·  Overdue: 2  ·  Est. Load: 46h

   You can still assign. The employee will be able to
   raise a workload concern after receiving the task.

   [ Assign Anyway ]   [ Choose Someone Else ]
```

> **Why soft, not hard?** Hard restrictions create operational dead-ends — urgent work must always be assignable. The warning creates awareness; the employee's response creates accountability.

---

## Feature 2 — Employee Response (Revised: No "Decline")

"Decline" is **removed**. Final authority belongs to TL/Admin. Instead, employees have two structured concern-raising options:

### ✅ Option A — Accept
- Mandatory comment (minimum 10 chars)
  - *"Will start after wrapping up the Ganesh project today"*
  - *"Need read access to the prod database first"*
- Task → `COMMITTED`, KPI clock starts
- TL notified

### 💬 Option B — Request Reassignment
Used when the employee genuinely cannot take this task.

- Employee selects a **reason category**:

  | Category | Example |
  |----------|---------|
  | Capacity overload | *"Currently at 120%, 2 overdue tasks in critical state"* |
  | Missing access / dependency | *"No access to the AWS environment needed for this"* |
  | Skill mismatch | *"This needs 3D modeling expertise I don't have"* |
  | Approved leave conflict | *"On approved leave May 20–25, deadline is May 23"* |

- Mandatory free-text explanation
- Task stays `PROPOSED` — TL receives notification with full reason
- TL can: reassign, adjust scope, or force-commit

### ⚠️ Option C — Raise Workload Concern
Used when the employee can do it, but wants the timeline or scope reviewed.

- Less formal than Request Reassignment — no category required
- Mandatory comment: *"Can we push the deadline 3 days? Have a critical handoff this week"*
- Task moves to `NEGOTIATING`
- Opens a structured discussion thread (see Feature 3)
- TL can accept the concern, adjust dates, or force-commit with a reason

### 🔒 Task Actions Guard (No Work before Acceptance)
To ensure employees commit to tasks before starting work on them:
- **Hide Quick Actions:** The "Quick Actions" panel (e.g., "Start Task", "Resume Task", "Mark for Review", "Put On Hold") is completely hidden from both the Task Details Dialog and the Task Row Actions dropdown menu unless the task's `lifecycleStatus` is `COMMITTED` (or not set, for legacy compatibility).
- **Progress Message:** In the "Current Progress" section, if the task is in `PROPOSED` or `NEGOTIATING` state, the message displays: *"Accept this task to begin working on it"* instead of *"Start this task to begin recording progress"*.

> **The key difference from v2**: There is no path where an employee can unilaterally exit from a task. They can surface concerns; TL/Admin makes the final call.

---

## Feature 3 — Rich Per-Task Communication Thread

Each task has a **unified activity thread** that is structured, task-linked, and audit-logged. This is **not** a general chat — it's a mission log for the task.

### Thread Entry Types

| Type | Who | What it looks like |
|------|-----|-------------------|
| `SYSTEM_EVENT` | Auto | *"Rahul accepted task · May 19, 10:32 AM"* |
| `COMMENT` | Anyone on task | Regular comment with optional @mention |
| `NEGOTIATION` | Employee or TL | *"⚠️ Workload concern: [message]" + proposed revised date* |
| `STATUS_CHANGE` | Auto | *"Status changed: IN_PROGRESS → IN_REVIEW"* |
| `ACCEPTANCE` | Employee | *"✅ Accepted: [comment]"* |
| `REASSIGNMENT_REQUEST` | Employee | *"↩️ Requested reassignment: [reason]"* |
| `FORCE_COMMIT` | TL/Admin | *"🔒 Force-committed: [reason]"* |
| `ATTACHMENT` | Anyone | File attached with filename + size |
| `APPROVAL` | TL/Admin | *"✅ TL Approved · Rating: 4/5 · [comment]"* |

### Thread Features
- **@mentions** — tag a user, they receive an in-app notification
- **File attachments** — upload supporting documents, screenshots, specs
  - Stored in existing file storage (or linked to an `uploadUrl`)
  - Displayed inline in thread
- **Timeline history** — every status change is automatically logged as a thread entry (already partially implemented via `ActivityLog`)
- **Pinned messages** — TL can pin critical instructions to the top

### What This Replaces / Consolidates
The thread **replaces** the current split between `TaskComment` and `ActivityLog` in the UI. Both feed into the same unified thread view, filtered by type. Under the hood, they remain two separate tables.

```
Task Detail Dialog Tabs:
  [ Overview ]  [ Thread 💬 12 ]  [ Approvals ]
```

---

## Schema Changes

### Updated `TaskComment`
```prisma
model TaskComment {
  id          String   @id @default(cuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content     String
  createdAt   DateTime @default(now())

  // New fields
  type        String   @default("COMMENT")
  // COMMENT | NEGOTIATION | ACCEPTANCE | REASSIGNMENT_REQUEST
  // FORCE_COMMIT | WORKLOAD_CONCERN | SYSTEM_EVENT

  attachmentUrl   String?   // File URL if attachment
  attachmentName  String?   // Original filename
  attachmentSize  Int?      // Bytes
  mentionedUserIds String[] // Array of user IDs mentioned via @
  proposedEnd     DateTime? // For NEGOTIATION type: proposed revised deadline
  isPinned        Boolean   @default(false)
}
```

### New fields on `Task`
```prisma
model Task {
  // ... all existing fields unchanged ...

  // Commitment workflow
  lifecycleStatus     TaskLifecycleStatus  @default(COMMITTED)
  proposedAt          DateTime?
  proposedById        String?
  employeeResponseAt  DateTime?
  committedAt         DateTime?
  committedByOverride Boolean              @default(false)
  negotiationCount    Int                  @default(0)

  // Workload snapshot (recorded at time of assignment — for historical reporting)
  assigneeCapacityAtAssignment  Int?   // % capacity when assigned (e.g. 120)
  assigneeActiveTasksAtAssignment Int? // Task count when assigned
}
```

### New enum
```prisma
enum TaskLifecycleStatus {
  PROPOSED      // Manager assigned, awaiting employee response
  NEGOTIATING   // Employee raised concern, discussion open
  COMMITTED     // Both agreed — maps to TODO in Kanban
}

enum ReassignmentReason {
  CAPACITY_OVERLOAD
  MISSING_DEPENDENCY
  SKILL_MISMATCH
  LEAVE_CONFLICT
  OTHER
}
```

### New `WorkloadSnapshot` (for capacity trend reporting)
```prisma
model WorkloadSnapshot {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  takenAt   DateTime @default(now())
  activeTasks     Int
  committedTasks  Int
  estimatedHours  Float
  capacityPct     Int
  overdueTasks    Int
}
```
> Snapshots are taken automatically when a task is assigned. Enables capacity trend charts over time.

---

## New / Updated Server Actions

| Action | Who | Comment required | What it does |
|--------|-----|-----------------|--------------|
| `getTeamWorkload(userIds[])` | TL/Admin | — | Returns live capacity data for assignment dialog |
| `createTask` (→ employee) | TL/Admin | — | Creates `PROPOSED`, takes workload snapshot, notifies |
| `createTask` (self) | Anyone | — | Creates `COMMITTED`, auto-logs |
| `respondToTask(id, "ACCEPT", comment)` | Assignee | ✅ | → `COMMITTED` |
| `respondToTask(id, "WORKLOAD_CONCERN", comment, proposedEnd?)` | Assignee | ✅ | → `NEGOTIATING` |
| `respondToTask(id, "REQUEST_REASSIGNMENT", reason, comment)` | Assignee | ✅ + category | Notifies TL, task stays `PROPOSED` |
| `replyToThread(id, message, proposedEnd?, attachmentUrl?)` | TL or Assignee | ✅ | Adds to task thread |
| `acceptNegotiation(id, comment)` | Assignee | ✅ | → `COMMITTED` |
| `forceCommitTask(id, reason)` | TL/Admin only | ✅ | → `COMMITTED` with override flag |
| `pinComment(commentId)` | TL/Admin | — | Pins message to top of thread |

---

## UI Summary

### Assignment Dialog (TL side)
- Team capacity panel with color-coded bars
- Soft warning modal if 90%+ capacity
- Workload snapshot auto-captured on submit

### Employee Inbox ("Pending Your Response")
- Badge count on nav
- Card per task: project, assigned by, priority, deadline, estimated hours
- Inline: *"Your current load: 6 active tasks · ~34h"*
- Two action paths: ✅ Accept · 💬 Raise Concern / Request Reassignment

### Task Detail — Unified Thread
```
[ Overview ]   [ Thread 💬 ]   [ Approvals ]
```
Thread shows all: comments, status changes, acceptance, concerns, file attachments, @mentions — chronological, each attributed with name + timestamp.

### Task Details & Row Actions Guard
- **Quick Actions Guard:** "Start Task", "Resume Task", etc. are hidden in both the Task Details dialog and task row dropdown unless the task is accepted/committed.
- **Instructional Alert:** Progress section shows *"Accept this task to begin working on it"* while in `PROPOSED` / `NEGOTIATING` states.

### Manager View — "Proposed" Pre-Column in Kanban
- Shows unacknowledged tasks with elapsed time
- Highlights tasks awaiting > 24h in amber

---

## Notification Matrix

| Event | Recipient | Channel |
|-------|-----------|---------|
| Task proposed | Employee | Push + in-app |
| Employee accepts | TL | In-app |
| Employee raises workload concern | TL | Push + in-app |
| Employee requests reassignment | TL | Push + in-app (with reason) |
| TL replies in thread | Employee | In-app |
| TL force-commits | Employee | Push + in-app (with reason) |
| @mention in thread | Mentioned user | In-app |
| Task unacknowledged > 24h | TL | In-app reminder |

---

## Backward Compatibility

- All existing tasks → `lifecycleStatus = COMMITTED` (one-time migration)
- `TaskComment` new fields are nullable — zero impact on existing comments
- `WorkloadSnapshot` is a new additive table
- Kanban board unchanged (only shows `COMMITTED` tasks, same as today)

---

## Implementation Phases

### Phase A — Schema + Backend (1–2 days)
1. Add fields to `Task` and `TaskComment`
2. Add `WorkloadSnapshot` model
3. Data migration: existing tasks → `COMMITTED`
4. `getTeamWorkload()` — live capacity calculation
5. `respondToTask()`, `replyToThread()`, `forceCommitTask()` server actions
6. Update `createTask` for lifecycle and snapshot

### Phase B — Assignment Dialog (1 day)
1. Workload intelligence panel in task assignment dialog
2. Soft warning modal for 90%+ capacity

### Phase C — Employee Inbox + Response UI (1 day)
1. "Pending Your Response" widget on dashboard
2. Accept modal with mandatory comment
3. Raise Concern modal with optional proposed date
4. Request Reassignment modal with category + comment

### Phase D — Unified Thread (1 day)
1. Thread tab in Task Detail Dialog
2. Merge `TaskComment` + `ActivityLog` into single chronological view
3. @mention support with inline notifications
4. File attachment upload + display

### Phase E — Manager Controls + Reporting (0.5 days)
1. "Proposed" pre-column in Kanban
2. Force-commit modal
3. `committedAt`, `capacityAtAssignment`, `committedByOverride` in master report
4. Capacity trend charts (from `WorkloadSnapshot`)

---

> **Ready to proceed?** Confirm Phase A to begin implementation.
