# Task Management System Documentation

This document outlines the architecture, security model, and user interface logic for the modernized Task Management System within the HRMS Dashboard.

## 1. Narrative Activity Timeline

The Activity Timeline provides a human-readable, narrative-driven audit trail for the entire lifecycle of a task.

### Data Source
*   **Source Table**: `ActivityLog` in the Prisma schema.
*   **Relationship**: Tasks have a one-to-many relationship with `ActivityLog`.
*   **Inclusions**: All task-fetching actions (`getProjectTasks`, `getMasterTaskReport`, and the Kanban board) include `activityLogs` and the associated `user` who performed the action.

### Activity Generation Logic
Logs are generated automatically within the following server actions:
*   **`createTask`**: Logs "Task allocated to [Name]" or "Created new task".
*   **`updateTask`**:
    *   **Status Changes**: Map to narrative descriptions (e.g., "Started working", "Sent to review", "Task Complete").
    *   **Parameter Changes**: Detects changes in priority, schedule, assignment, or description and logs a summary (e.g., "Updated task priority, schedule").
*   **`approveTask`**: Logs "Approved" or "Rejected: [Reason]".

### UI Presentation
*   **Format**: Minimalist journey-focused design in the `TaskDetailsDialog`.
*   **Timestamp**: 12-hour clock format (MMM d, hh:mm AM/PM).
*   **Narrative Focus**: Redundant task titles and technical labels (like "UPDATE TASK") have been removed to focus on the *what* and *who*.

---

## 2. Unified Task Intelligence Hub

The system consolidates all task management into a single, high-performance interface.

### View Scopes
*   **My Tasks**: Filters tasks assigned to the current user (`assignedToId === currentUserId`).
*   **Team Tasks**: (Visible to TLs & Admins) Filters tasks belonging to the user's department OR assigned to their team members/direct subordinates.
*   **All Project Tasks**: Global overview of all tasks (Visibility gated by Admin/TL roles).

### Display Modes
*   **List View**: High-density table for detailed oversight.
*   **Board View (Kanban)**: Interactive drag-and-drop workflow management.

---

## 3. Task Security & Authority Model

The system enforces a strict role-based security model to ensure departmental integrity.

### Authority Definitions
*   **Admin/System Admin**: Global authority. Can create, update, approve, and delete any task in the system.
*   **Team Leader (TL)**: Departmental/Team authority.
    *   **Update/Approve**: Can manage tasks assigned to them, tasks in their department, or tasks assigned to their team members.
    *   **Delete**: Restricted to tasks assigned to them or their own team/department. **Cannot delete tasks from other departments.**
*   **Team Member**: Personal authority.
    *   Can update the status of tasks assigned to them (except for marking as "Done/Completed" which requires TL/Admin authority).
    *   Cannot delete tasks.

### Authorization Logic (Server-Side)
The `deleteTask` and `approveTask` actions perform the following checks:
1.  **Is Admin?** → Allow.
2.  **Is TL?**
    *   Check `task.assignedToId === user.id` (Self-assigned).
    *   Check `task.departmentId === user.departmentId`.
    *   Check `task.assignedTo.departmentId === user.departmentId`.
    *   Check `task.assignedTo.managerId === user.id`.
3.  **Result**: If none of the above match, the action is rejected with "Access Denied".

---

## 4. Design Guidelines

*   **Premium Aesthetics**: Use modern typography (Inter/Outfit), subtle gradients, and glassmorphism effects.
*   **Micro-interactions**: Use hover effects, smooth transitions, and tooltips (wrapped in `TooltipProvider`) to enhance the premium feel.
*   **Minimalism**: Prioritize essential information. Use icons instead of text where possible (e.g., the Lock icon for restricted tasks).
