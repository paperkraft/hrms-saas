# Resigned & Inactive User Data Retention Plan

This plan establishes a comprehensive soft-deactivation & data retention model for resigned or inactive employees. It ensures that when a user resigns:
1. **No data is hard-deleted** from the system.
2. **Project, Task, and Document data** assigned to or uploaded by the resigned user remains active, intact, and accessible to admins and team members.
3. Resigned users are **blocked from logging in**.
4. Active dropdowns (e.g., assigning new tasks, creating leave requests) exclude resigned users, while past assignments clearly indicate `(Resigned)`.
5. Admins are provided with a dedicated workflow to mark users as Resigned/Inactive with an option to bulk reassign their active tasks to another employee.

---

## User Review Required

> [!IMPORTANT]
> **No Hard Deletes**: The existing `deleteUser` action previously executed `prisma.user.delete`, which caused foreign-key database constraints to fail and risked deleting historical records. This action will now soft-deactivate/mark the user as `RESIGNED` or `INACTIVE`.
> 
> **Access & Logins**: Resigned users will be blocked from logging into the platform immediately.
> 
> **Task Reassignment Option**: When marking an employee as resigned, admins can optionally select another active team member to seamlessly adopt all pending/in-progress tasks of the resigning employee.

---

## Open Questions

- None at present. The requirements explicitly state not to hard delete any data and to keep all Project, Task, and Document references active and accessible to other users and admins.

---

## Proposed Changes

### Data Model Layer

#### [MODIFY] [schema.prisma](file:///d:/SV/Live%20projects/hrms/prisma/schema.prisma)
- Add enum `EmploymentStatus`:
  ```prisma
  enum EmploymentStatus {
    ACTIVE
    RESIGNED
    INACTIVE
    TERMINATED
  }
  ```
- Add fields to `User` model:
  - `status EmploymentStatus @default(ACTIVE)`
  - `resignationDate DateTime? @db.Date`
  - `resignationReason String?`
- Add index on `status`: `@@index([status])`

---

### Authentication & Server Actions

#### [MODIFY] [auth.ts](file:///d:/SV/Live%20projects/hrms/src/lib/auth.ts)
- Check `user.status` during credential authorization.
- Reject login attempts for users with status `RESIGNED`, `INACTIVE`, or `TERMINATED` with a descriptive message ("Account is resigned or inactive").

#### [MODIFY] [user.ts](file:///d:/SV/Live%20projects/hrms/src/actions/user.ts)
- Update `deleteUser(id)` to perform soft status update (`status: "RESIGNED"`, `resignationDate: new Date()`) instead of database deletion.
- Add `setUserEmploymentStatus(id, status, resignationDate?, resignationReason?, reassignTasksToId?)`:
  - Updates user status and resignation metadata.
  - If `reassignTasksToId` is provided, bulk updates `Task` records (`assignedToId = reassignTasksToId`) for pending tasks.
  - Deactivates any active `RecurringTaskSchedule` where `assignedToId === id`.
- Update `getEmployeesForDropdown()`: Filter by `status: "ACTIVE"` for new assignments.
- Update `getAdminUsersData()`: Include `status`, `resignationDate`, and `resignationReason` fields.

#### [MODIFY] [route.ts](file:///d:/SV/Live%20projects/hrms/src/app/api/users/active/route.ts)
- Filter `prisma.user.findMany` with `status: "ACTIVE"` for active user endpoints.

---

### UI & Admin Management Components

#### [NEW] [resignation-dialog.tsx](file:///d:/SV/Live%20projects/hrms/src/components/features/admin/resignation-dialog.tsx)
- Create a dedicated dialog component for marking a user as Resigned or Inactive.
- Inputs for Resignation Date, Resignation Notes, and optional Task Transfer dropdown to select an active employee to take over open tasks.

#### [MODIFY] [user-management-table.tsx](file:///d:/SV/Live%20projects/hrms/src/components/features/admin/user-management-table.tsx)
- Add filter tabs: `All`, `Active`, `Resigned`, `Inactive`.
- Render a status badge column (`Active` in green, `Resigned` in amber/orange, `Inactive` in gray).
- Integrate `ResignationDialog` in place of hard deletion.
- Add a "Re-activate User" option for resigned/inactive accounts.

#### [MODIFY] [edit-user-dialog.tsx](file:///d:/SV/Live%20projects/hrms/src/components/features/admin/edit-user-dialog.tsx)
- Add fields for `status`, `resignationDate`, and `resignationReason` so admins can view or adjust employment status directly.

---

### Task, Project & Document Visualization Updates

#### [MODIFY] [kanban-board.tsx](file:///d:/SV/Live%20projects/hrms/src/components/features/projects/kanban-board.tsx)
#### [MODIFY] [master-task-report-client.tsx](file:///d:/SV/Live%20projects/hrms/src/components/features/projects/master-task-report-client.tsx)
#### [MODIFY] [task-details-dialog.tsx](file:///d:/SV/Live%20projects/hrms/src/components/features/projects/task-details-dialog.tsx)
- Display `(Resigned)` next to uploader/assignee name if `user.status === "RESIGNED"`.
- Keep all tasks, comments, activity logs, and documents intact and fully visible to project members and admins.

---

## Verification Plan

### Automated Verification
- Run `npx prisma db push` or schema validation to ensure DB model updates compile cleanly.
- Run `npm run build` or Next.js build check to ensure no type errors.

### Manual Verification
1. **Status Transition & Soft Delete**:
   - Go to Admin > Employees page.
   - Mark an employee as "Resigned". Verify the status badge updates to "Resigned" and no foreign key database error occurs.
2. **Task & Document Preservation**:
   - Open a project containing tasks and documents created by or assigned to the resigned user.
   - Verify all tasks and documents remain visible, accessible, editable, and download-able.
   - Verify assignee tag displays `Name (Resigned)`.
3. **Login Block**:
   - Attempt to log in with the credentials of the resigned user. Confirm login is blocked with an appropriate message.
4. **Active Selection Filter**:
   - Open the "Create Task" or "New Leave Request" form. Confirm the resigned user is excluded from active assignee/user selection dropdowns.
5. **Bulk Task Reassignment**:
   - Reassign a resigned user's tasks to another active user using the Resignation dialog. Confirm all open tasks are transferred cleanly.
