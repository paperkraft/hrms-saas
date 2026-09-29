# Implementation Plan: Project Management Module

This document outlines the plan to integrate a Project Management module into the existing HRMS.

## 1. Data Model Requirements

We will add two primary models to the Prisma schema: `Project` and `Task`.

### Project Model
- `id`: Unique identifier (CUID)
- `name`: Name of the project
- `description`: Detailed description
- `teamLeaderId`: Reference to the `User` assigned as the lead for **this specific project**.
- `status`: Project status (Active, Completed, On Hold)
- `createdAt` / `updatedAt`

### Task Model
- `id`: Task-ID (Incremental or CUID)
- `projectId`: Reference to the parent Project
- `name`: Name of the task
- `description`: Detailed task description
- `assignedToId`: Reference to the `User` (Team Member)
- `priority`: Enum (LOW, MEDIUM, HIGH, URGENT)
- `status`: Enum (TODO, IN_PROGRESS, IN_REVIEW, COMPLETED)
- `plannedStart`: DateTime
- `plannedEnd`: DateTime
- `actualEnd`: DateTime (Filled on completion)
- `plannedDuration`: Number (Hours/Days)
- `progress`: Number (0-100%)
- `approvalStatus`: Enum (PENDING, APPROVED, REJECTED)
- `dateSentForApproval`: DateTime
- `activity`: Activity type (e.g., Development, Testing, Documentation)
- `team`: Derived from user department or explicit field

## 2. Role-Based Functionality

### Admin
- **Manage Projects**: Create new projects and assign them to Team Leaders.
- **Master Report**: A comprehensive table view of all tasks with filters.
- **Analytics**: 
  - Overall project progress (weighted average of task progress).
  - Individual performance metrics (comparing `actualEnd` vs `plannedEnd` considering `priority`).

### Team Leader (Project-Specific)
- **Contextual Role**: A user acts as a Team Leader only for projects they are assigned to lead.
- **Task Management**: Create tasks within projects assigned to them.
- **Assignment**: Assign tasks to team members.
- **Approvals**: Review, approve, or reject tasks submitted by members.
- **Team View**: Monitor the progress of their specific project team.

### Team Member
- **Flexible Role**: A user can be a Team Member in one project while being a Team Leader in another.
- **Kanban Board**: A visual interface to move tasks between stages (To Do -> In Progress -> Review).
- **Task Creation**: Create own tasks if not assigned by a Team Leader (self-assigned).
- **Progress Updates**: Update task completion percentage and add notes.
- **Approval Submission**: Mark tasks as ready for review.

## 3. Key UI Components

### Project Master Table (Admin)
The table will include the following columns as requested:
- Task-ID, Project Name, Project ID, Task, Task Description, Assigned To, Priority, Planned Duration, Planned Start, Planned End, Progress (%), Status, Sent for Approval Date, Approval Status, Actual End, Activity, Team, Team Lead.

### Kanban Board (Member)
- Visual columns: `To Do`, `In Progress`, `Review`, `Done`.
- Drag-and-drop functionality for status updates.

### Performance Dashboard
- **Individual Performance Score**: 
  - `Score = (Planned Duration / Actual Duration) * Priority Weight`.
  - Bonus for early completion; penalty for delays.

## 4. Implementation Phases

### Phase 1: Database & API
1. Update `prisma/schema.prisma` with new models and enums.
2. Run database migration/push.
3. Create Server Actions for Project and Task CRUD operations.

### Phase 2: Admin Features
1. Create Project Creation interface.
2. Build the Master Report table with export capabilities.
3. Implement basic progress aggregation.

### Phase 3: Team Leader & Member Features
1. Task assignment interface for Team Leaders.
2. Kanban board implementation for Team Members.
3. Approval workflow logic.

### Phase 4: Performance Analytics
1. Implement the scoring algorithm.
2. Create visualization charts for project and individual performance.

---
**Next Steps**: Please review this plan. If approved, I will begin by updating the Prisma schema.
