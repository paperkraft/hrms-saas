"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { authorizeProjectManager, getLedDepartmentIds, getSession } from "./core"
import { logActivity } from "@/lib/activity-logger"
import { isExternalUser } from "@/lib/permissions"
import { createNotification, createManyNotifications } from "@/actions/notification"

export async function getProjectTasks(projectId: string) {
  try {
    const session = await getSession()
    const isExternal = isExternalUser(session.user)
    const whereClause: any = { projectId }

    if (isExternal) {
      const isSharedProject = await prisma.projectShare.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: session.user.id
          }
        }
      })

      if (!isSharedProject) {
        whereClause.OR = [
          { createdById: session.user.id },
          { assignedToId: session.user.id },
          { reviewerId: session.user.id },
        ]
      }
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: { select: { name: true } },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            managerId: true,
            departmentId: true,
            avatarUrl: true,
            department: {
              select: {
                id: true,
                name: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true } },
                parentDepartmentId: true,
                parentDepartment: {
                  select: {
                    id: true,
                    name: true,
                    teamLeaderId: true,
                    teamLeader: { select: { id: true, name: true } }
                  }
                }
              }
            },
            ledDepartments: { select: { id: true } }
          }
        },
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reviewer: { select: { id: true, name: true, avatarUrl: true, role: true } },
        department: {
          select: {
            id: true,
            name: true,
            teamLeaderId: true,
            teamLeader: { select: { id: true, name: true } },
            parentDepartmentId: true,
            parentDepartment: {
              select: {
                id: true,
                name: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true } }
              }
            }
          }
        },
        comments: {
          include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" }
        },
      },
      orderBy: { createdAt: "desc" }
    })

    return { success: true, data: tasks }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function createTask(data: any) {
  try {
    const session = await getSession()

    // ── Peer delegation guard ─────────────────────────────────────────────────
    // Regular employees can only assign to themselves
    const isAdminOrTL = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"
    const deptLed = await prisma.department.findFirst({ where: { teamLeaderId: session.user.id } })
    const hasSubordinates = await prisma.user.findFirst({ where: { managerId: session.user.id } })
    const canAssignOthers = isAdminOrTL || !!deptLed || !!hasSubordinates

    const assignedToId = data.assignedToId === "" ? null : data.assignedToId
    const isSelfAssigned = !assignedToId || assignedToId === session.user.id

    const isExternal = isExternalUser(session.user)
    if (isExternal) {
      if (!isSelfAssigned && assignedToId) {
        // External user can only assign to others if they have a team member in their dept and the assignee is in their dept
        const userDepts = await prisma.userDepartment.findMany({
          where: { userId: session.user.id },
          select: { departmentId: true }
        })
        const deptIds = userDepts.map(d => d.departmentId)
        if (session.user.departmentId) deptIds.push(session.user.departmentId)

        if (deptIds.length === 0) {
          throw new Error("Authority Required: You can only assign tasks to team members within your department.")
        }

        const isAssigneeInDept = await prisma.userDepartment.findFirst({
          where: {
            userId: assignedToId,
            departmentId: { in: deptIds }
          }
        }) || await prisma.user.findFirst({
          where: {
            id: assignedToId,
            departmentId: { in: deptIds }
          }
        })

        if (!isAssigneeInDept) {
          throw new Error("Authority Required: You can only assign tasks to team members within your department.")
        }
      }
    } else {
      if (!isSelfAssigned && !canAssignOthers) {
        throw new Error("Authority Required: You can only create tasks for yourself. Assigning to team members requires Team Leader or Admin permissions.")
      }
    }

    // ── Lifecycle determination ───────────────────────────────────────────────
    // Self-assigned (by anyone): auto-COMMITTED, no proposal loop
    // Manager/TL → employee: PROPOSED, awaiting acknowledgment
    const lifecycleStatus = isSelfAssigned ? "COMMITTED" : "PROPOSED"
    const now = new Date()

    // ── Workload snapshot at assignment time ──────────────────────────────────
    let capacitySnapshot = { capacityPct: null as number | null, activeTasks: null as number | null }
    if (!isSelfAssigned && assignedToId) {
      // Inline workload calculation (avoids circular import with task-commitment)
      const activeCount = await prisma.task.count({
        where: {
          assignedToId,
          status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
          lifecycleStatus: { in: ["PROPOSED", "NEGOTIATING", "COMMITTED"] }
        }
      })

      const activeTasks = await prisma.task.findMany({
        where: { assignedToId, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } },
        select: { plannedDuration: true, progress: true }
      })

      const estimatedHours = activeTasks.reduce((sum, t) => {
        const days = t.plannedDuration ?? 1
        return sum + days * (1 - t.progress / 100) * 8
      }, 0)

      const capacityPct = Math.round((estimatedHours / 40) * 100)

      capacitySnapshot = { capacityPct, activeTasks: activeCount }

      // Persist snapshot record
      const overdueCount = await prisma.task.count({
        where: {
          assignedToId,
          status: { notIn: ["COMPLETED"] },
          plannedEnd: { lt: now }
        }
      })

      await prisma.workloadSnapshot.create({
        data: {
          tenantId: session.user.tenantId!,
          userId: assignedToId,
          activeTasks: activeCount,
          committedTasks: await prisma.task.count({ where: { assignedToId, lifecycleStatus: "COMMITTED" } }),
          estimatedHours: Math.round(estimatedHours * 10) / 10,
          capacityPct,
          overdueTasks: overdueCount
        }
      })
    }

    // ── Sanitize data ─────────────────────────────────────────────────────────
    let targetDepartmentId = data.departmentId === "" ? null : data.departmentId
    let assignee = null
    if (assignedToId) {
      assignee = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { id: true, parentDepartmentId: true } }
        }
      })
      // If assignee belongs to a sub-department and task department is empty or matches the parent, adopt the sub-department
      if (assignee?.department?.parentDepartmentId) {
        if (!targetDepartmentId || targetDepartmentId === assignee.department.parentDepartmentId) {
          targetDepartmentId = assignee.departmentId
        }
      }
    }

    let targetProjectId = data.projectId
    if (isExternal) {
      let isAllowedSharedProject = false
      if (data.projectId) {
        const sharedAccess = await prisma.projectShare.findUnique({
          where: {
            projectId_userId: {
              projectId: data.projectId,
              userId: session.user.id
            }
          }
        })
        if (sharedAccess) {
          isAllowedSharedProject = true
          targetProjectId = data.projectId
        }
      }

      if (!isAllowedSharedProject) {
        let extProject = await prisma.project.findFirst({
          where: { tenantId: session.user.tenantId, name: { equals: "External", mode: "insensitive" } },
          select: { id: true }
        })
        if (!extProject) {
          extProject = await prisma.project.create({
            data: {
              tenantId: session.user.tenantId!,
              name: "External",
              description: "Dedicated project workspace for external collaborator deliverables and tasks",
              status: "ACTIVE"
            },
            select: { id: true }
          })
        }
        targetProjectId = extProject.id
      }
    }

    const sanitizedData = {
      ...data,
      projectId: targetProjectId || data.projectId,
      assignedToId,
      departmentId: targetDepartmentId,
      reviewerId: data.reviewerId === "" ? null : data.reviewerId,
      team: data.team === "" ? null : data.team,
      plannedDuration: typeof data.plannedDuration === 'number' ? data.plannedDuration : parseFloat(data.plannedDuration) || null,
      status: lifecycleStatus === "PROPOSED" ? "TODO" : (data.status || "TODO"),
      priority: data.priority || "MEDIUM",
      createdById: session.user.id,
      // Commitment workflow fields
      lifecycleStatus,
      proposedById: !isSelfAssigned ? session.user.id : null,
      proposedAt: !isSelfAssigned ? now : null,
      committedAt: isSelfAssigned ? now : null,
      assigneeCapacityAtAssignment: capacitySnapshot.capacityPct,
      assigneeActiveTasksAtAssignment: capacitySnapshot.activeTasks,
      // Thread Enrichment fields for task description
      attachments: data.attachments || undefined,
      mentionedUserIds: data.mentionedUserIds || []
    }

    const task = await prisma.task.create({
      data: sanitizedData
    })

    const activityDetail = isSelfAssigned
      ? `Created self-assigned task — auto-committed`
      : `Task proposed to ${assignee?.name} · Capacity at assignment: ${capacitySnapshot.capacityPct ?? "N/A"}%`

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      userId: session.user.id,
      action: "CREATE_TASK",
      details: activityDetail
    })

    // ── Notify employee when proposed ─────────────────────────────────────────
    if (!isSelfAssigned && assignedToId) {
      await createNotification({
        userId: assignedToId,
        title: "New Task Assigned — Awaiting Your Response",
        message: `${session.user.name} assigned you "${task.name}" — please review and accept, raise a concern, or request reassignment.`,
        type: "INFO",
        link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
      })
    }

    // Notify reviewer if explicitly set
    if (task.reviewerId && task.reviewerId !== session.user.id && task.reviewerId !== assignedToId) {
      await createNotification({
        userId: task.reviewerId,
        title: "Assigned as Task Reviewer",
        message: `${session.user.name} assigned you as the Reviewer for task "${task.name}".`,
        type: "INFO",
        link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
      })
    }

    // Notify mentioned users
    if (sanitizedData.mentionedUserIds && sanitizedData.mentionedUserIds.length > 0) {
      const mentionsToNotify = sanitizedData.mentionedUserIds.filter(
        (id: string) => id !== session.user.id && id !== assignedToId && id !== task.reviewerId
      );

      if (mentionsToNotify.length > 0) {
        await prisma.notification.createMany({
          data: mentionsToNotify.map((userId: string) => ({
            userId,
            title: "Mentioned in New Task",
            content: `${session.user.name} mentioned you in the description of task "${task.name}".`,
            type: "INFO",
            link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
          }))
        });
      }
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)
    revalidatePath("/dashboard/projects/reports")
    return { success: true, data: task }
  } catch (error: any) {
    console.error("CREATE_TASK_ERROR:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}

export async function updateTask(id: string, data: any) {
  try {
    const session = await getSession()

    const oldTask = await prisma.task.findUnique({
      where: { id },
      include: { assignedTo: { select: { departmentId: true } } }
    })
    if (!oldTask) throw new Error("Task not found")

    // Sanitize data
    const sanitizedData = { ...data }
    if (sanitizedData.assignedToId === "") sanitizedData.assignedToId = null
    if (sanitizedData.departmentId === "") sanitizedData.departmentId = null
    if (sanitizedData.reviewerId === "") sanitizedData.reviewerId = null
    if (sanitizedData.team === "") sanitizedData.team = null
    if (sanitizedData.plannedDuration === "") sanitizedData.plannedDuration = null

    // Prevent moving COMPLETED tasks back to other columns
    if (oldTask.status === "COMPLETED" && sanitizedData.status && sanitizedData.status !== "COMPLETED") {
      throw new Error("Finalized: Completed tasks cannot be moved back to other columns. Use the formal Rejection flow to return a task to In Progress.")
    }

    // Prevent non-admin/non-TL from marking as COMPLETED
    if (sanitizedData.status === "COMPLETED" || data.status === "COMPLETED") {
      const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"
      const ledDepartmentIds = await getLedDepartmentIds(session.user.id)

      const isTL = ledDepartmentIds.length > 0 && (ledDepartmentIds.includes(oldTask.departmentId || "") || ledDepartmentIds.includes(oldTask.assignedTo?.departmentId || ""))

      if (!isAdmin && !isTL) {
        throw new Error("Authority Required: Only Admin or Department Leaders can mark tasks as Done through approval.")
      }

      // We force the approval flow for COMPLETED.
      delete sanitizedData.status
      throw new Error("Tasks must be finalized through the Approval process (Approve button).")
    }

    // Progress update restriction: Only assignee can update progress manually
    if (sanitizedData.progress !== undefined && sanitizedData.progress !== oldTask.progress) {
      if (oldTask.assignedToId !== session.user.id) {
        throw new Error("Authority Required: Only the task assignee can update the progress percentage.")
      }

      // Automatically advance or revert status based on progress
      if (sanitizedData.progress === 100 && (oldTask.status === "IN_PROGRESS" || oldTask.status === "TODO")) {
        sanitizedData.status = "IN_REVIEW"
      } else if (sanitizedData.progress > 0 && oldTask.status === "TODO") {
        sanitizedData.status = "IN_PROGRESS"
      } else if (sanitizedData.progress < 100 && oldTask.status === "IN_REVIEW") {
        sanitizedData.status = "IN_PROGRESS"
      }
    }

    if (sanitizedData.status === "IN_REVIEW" && oldTask.status !== "IN_REVIEW") {
      sanitizedData.submittedAt = new Date()
    }

    const isAssignmentChanged = sanitizedData.assignedToId !== undefined && sanitizedData.assignedToId !== oldTask.assignedToId

    if (isAssignmentChanged) {
      const isExternal = isExternalUser(session.user)
      if (isExternal && sanitizedData.assignedToId && sanitizedData.assignedToId !== session.user.id) {
        const userDepts = await prisma.userDepartment.findMany({
          where: { userId: session.user.id },
          select: { departmentId: true }
        })
        const deptIds = userDepts.map(d => d.departmentId)
        if (session.user.departmentId) deptIds.push(session.user.departmentId)

        if (deptIds.length === 0) {
          throw new Error("Authority Required: You can only assign tasks to team members within your department.")
        }

        const isAssigneeInDept = await prisma.userDepartment.findFirst({
          where: {
            userId: sanitizedData.assignedToId,
            departmentId: { in: deptIds }
          }
        }) || await prisma.user.findFirst({
          where: {
            id: sanitizedData.assignedToId,
            departmentId: { in: deptIds }
          }
        })

        if (!isAssigneeInDept) {
          throw new Error("Authority Required: You can only assign tasks to team members within your department.")
        }
      }

      sanitizedData.lifecycleStatus = "PROPOSED"
    }

    const task = await prisma.task.update({
      where: { id },
      data: sanitizedData,
      include: {
        project: true,
        assignedTo: { select: { name: true } },
      }
    })

    // Log specific status transitions if status was updated
    if (sanitizedData.status && sanitizedData.status !== oldTask.status) {
      const getStatusDetails = (status: string) => {
        switch (status) {
          case "IN_PROGRESS": return "Changed status to In Progress"
          case "IN_REVIEW": return "Changed status to In Review"
          case "COMPLETED": return "Marked task as Completed"
          case "ON_HOLD": return "Changed status to On Hold"
          case "TODO": return "Changed status to To Do"
          default: return `Changed status to ${status.replace("_", " ")}`
        }
      }

      await logActivity({
        projectId: task.projectId,
        taskId: task.id,
        userId: session.user.id,
        action: "UPDATE_TASK",
        details: getStatusDetails(sanitizedData.status)
      })

      if (sanitizedData.status === "IN_REVIEW") {
        const notifyUserIds = new Set<string>();

        if (oldTask.reviewerId) {
          notifyUserIds.add(oldTask.reviewerId);
        } else {
          const departmentId = oldTask.assignedTo?.departmentId;
          const tl = departmentId ? await prisma.department.findUnique({ where: { id: departmentId }, select: { teamLeaderId: true } }) : null;
          if (tl?.teamLeaderId) notifyUserIds.add(tl.teamLeaderId);
        }

        const admins = await prisma.user.findMany({ where: { tenantId: session.user.tenantId, role: "ADMIN" }, select: { id: true } });
        admins.forEach(admin => notifyUserIds.add(admin.id));

        notifyUserIds.delete(session.user.id);

        const notifications = Array.from(notifyUserIds).map(userId => ({
          userId,
          title: "Task Ready for Review",
          message: `Task "${oldTask.name}" has been moved to In Review and requires your approval.`,
          type: "INFO",
          link: `/dashboard/projects/${oldTask.projectId}`
        }));

        if (notifications.length > 0) {
          await createManyNotifications(notifications);
        }
      }
    } else {
      const changedFields = []
      if (sanitizedData.priority !== undefined && sanitizedData.priority !== oldTask.priority) changedFields.push("priority")
      if (sanitizedData.plannedEnd !== undefined && new Date(sanitizedData.plannedEnd).getTime() !== oldTask.plannedEnd?.getTime()) changedFields.push("schedule")
      if (sanitizedData.plannedStart !== undefined && new Date(sanitizedData.plannedStart).getTime() !== oldTask.plannedStart?.getTime() && !changedFields.includes("schedule")) changedFields.push("schedule")
      if (sanitizedData.progress !== undefined && sanitizedData.progress !== oldTask.progress) changedFields.push("progress")
      if (sanitizedData.description !== undefined && sanitizedData.description !== oldTask.description) changedFields.push("description")
      if (sanitizedData.name !== undefined && sanitizedData.name !== oldTask.name) changedFields.push("title")

      let detail = "Modified task parameters"

      if (isAssignmentChanged) {
        detail = task.assignedTo?.name ? `Reassigned task to ${task.assignedTo.name}` : "Unassigned task"
      } else if (changedFields.length === 1 && changedFields[0] === "progress") {
        detail = `Updated progress to ${sanitizedData.progress}%`
      } else if (changedFields.length > 0) {
        detail = `Updated task ${changedFields.join(", ")}`
      } else if (Object.keys(sanitizedData).length > 0) {
        // Fallback if we didn't track the specific field but something changed
        detail = "Updated task details"
      } else {
        // Nothing changed, don't log
        detail = ""
      }

      if (detail && (isAssignmentChanged || changedFields.length > 0 || (Object.keys(sanitizedData).length > 0 && !sanitizedData.status))) {
        await logActivity({
          projectId: task.projectId,
          taskId: task.id,
          userId: session.user.id,
          action: "UPDATE_TASK",
          details: detail
        })
      }
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)
    revalidatePath("/dashboard/projects/reports")

    // Refetch to include the latest activity log created above
    const refreshedTask = await prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        assignedTo: { select: { id: true, name: true } },
      }
    })

    return { success: true, data: refreshedTask }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteTask(id: string) {
  try {
    const session = await getSession()
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"

    const taskToAuth = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: { departmentId: true, managerId: true }
        }
      }
    })

    if (!taskToAuth) throw new Error("Task not found")

    if (!isAdmin) {
      const ledDepartmentIds = await getLedDepartmentIds(session.user.id)

      const isMyTask = taskToAuth.assignedToId === session.user.id
      const isMyDeptTask = taskToAuth.departmentId ? ledDepartmentIds.includes(taskToAuth.departmentId) : false
      const isMyMemberTask = taskToAuth.assignedTo?.departmentId ? ledDepartmentIds.includes(taskToAuth.assignedTo.departmentId) : false
      const isMySubordinateTask = taskToAuth.assignedTo?.managerId === session.user.id

      if (!isMyTask && !isMyDeptTask && !isMyMemberTask && !isMySubordinateTask) {
        throw new Error("Access Denied: You can only delete tasks belonging to your team or assigned to yourself.")
      }
    }

    // Collect all attachment URLs to clean them up from MinIO
    const urlsToDelete: string[] = []

    // 1. Task description attachments
    if (taskToAuth.attachments && Array.isArray(taskToAuth.attachments)) {
      taskToAuth.attachments.forEach((att: any) => {
        if (att?.url) urlsToDelete.push(att.url)
      })
    }

    // 2. Discussion / comment attachments
    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      select: { attachments: true }
    })

    for (const comment of comments) {
      if (comment.attachments && Array.isArray(comment.attachments)) {
        comment.attachments.forEach((att: any) => {
          if (att?.url) urlsToDelete.push(att.url)
        })
      }
    }

    if (urlsToDelete.length > 0) {
      const { getMainStorageBucket } = await import("@/lib/drive-storage");
      const bucket = getMainStorageBucket();

      try {
        const { minioClient } = await import("@/lib/minio");

        for (const url of urlsToDelete) {
          if (!url) continue;

          let objectName = "";
          if (url.includes("/api/task/")) {
            objectName = url.split("/api/task/")[1];
            if (!objectName.startsWith("tasks/")) {
              objectName = "tasks/" + objectName;
            }
          } else if (url.includes("storage.infraplan.co.in/hrms/")) {
            objectName = url.split("storage.infraplan.co.in/hrms/")[1];
          }

          objectName = objectName.split("?")[0];

          if (objectName) {
            await minioClient.removeObject(bucket, objectName).catch(e => {
              console.error("Minio delete error during task deletion", e)
            })
          }
        }
      } catch (e) {
        console.error("Failed to load minio client for task deletion cleanup", e)
      }
    }

    // Cleanup associated data to optimize storage before removing the task
    const [_, __, task] = await prisma.$transaction([
      prisma.activityLog.deleteMany({ where: { taskId: id } }),
      prisma.taskComment.deleteMany({ where: { taskId: id } }),
      prisma.task.delete({ where: { id } })
    ])

    await logActivity({
      projectId: task.projectId,
      userId: session.user.id,
      action: "DELETE_TASK",
      details: `Deleted task: ${task.name}`
    })

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${task.projectId}`)
    revalidatePath("/dashboard/projects/reports")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function approveTask(id: string, status: "APPROVED" | "REJECTED", reason?: string, rating?: number) {
  try {
    const session = await getSession()
    if (status === "REJECTED" && !reason) {
      throw new Error("Reason is required for rejection")
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            parentDepartmentId: true,
            teamLeaderId: true,
            teamLeader: { select: { id: true, name: true, role: true } },
            parentDepartment: {
              select: {
                id: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true, role: true } }
              }
            }
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            managerId: true,
            department: {
              select: {
                id: true,
                parentDepartmentId: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true, role: true } },
                parentDepartment: {
                  select: {
                    id: true,
                    teamLeaderId: true,
                    teamLeader: { select: { id: true, name: true, role: true } }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!task) throw new Error("Task not found")

    // Determine department hierarchy
    const assigneeDept = task.assignedTo?.department
    const taskDept = task.department
    const isAssigneeSub = !!assigneeDept?.parentDepartmentId
    const isTaskSub = !!taskDept?.parentDepartmentId

    const subDept = isTaskSub ? taskDept : (isAssigneeSub ? assigneeDept : null)
    const parentDept = isTaskSub
      ? (taskDept?.parentDepartment || taskDept)
      : (isAssigneeSub ? (assigneeDept?.parentDepartment || taskDept) : (taskDept || assigneeDept))

    const isSubDepartment = !!subDept
    const subDepartmentLeaderId = subDept ? (subDept.teamLeaderId || (subDept as any).teamLeader?.id) : null
    const parentDepartmentLeaderId = parentDept ? (parentDept.teamLeaderId || (parentDept as any).teamLeader?.id) : null

    const isActuallyAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"
    const ledDepartmentIds = await getLedDepartmentIds(session.user.id)
    const isAssignee = task.assignedToId === session.user.id

    // Reviewer & Leader flags
    const isExplicitReviewer = !!task.reviewerId && task.reviewerId === session.user.id
    const isSubTL = (subDepartmentLeaderId && subDepartmentLeaderId === session.user.id) || isExplicitReviewer
    const isParentTL = (parentDepartmentLeaderId && parentDepartmentLeaderId === session.user.id) ||
      (parentDept?.id && ledDepartmentIds.includes(parentDept.id)) ||
      (task.assignedTo?.managerId === session.user.id && session.user.id !== subDepartmentLeaderId)
    const isManager = task.assignedTo?.managerId === session.user.id
    const isCreator = task.createdById === session.user.id

    // External User Isolation: External users can ONLY review/approve tasks if they are the designated reviewer
    const isExternal = isExternalUser(session.user)
    if (isExternal) {
      if (!isExplicitReviewer) {
        throw new Error("Authority Required: You can only review tasks where you are designated as the reviewer.")
      }
      if (isAssignee) {
        throw new Error("Self-Approval Restricted: As the task assignee, you cannot approve your own work.")
      }
    }

    // Authority Check
    const hasAnyAuthority = isActuallyAdmin || isExplicitReviewer || isSubTL || isParentTL || isManager || isCreator
    if (!hasAnyAuthority || (isAssignee && !isActuallyAdmin)) {
      if (isAssignee) {
        throw new Error("Self-Approval Restricted: As the task assignee, you cannot approve your own work. Please wait for your Team Leader or Admin approval.")
      }
      throw new Error("Authority Required: You do not have authority to approve or reject this task.")
    }

    // Determine workflow requirements
    let leaderUserRole = parentDept?.teamLeader?.role
    if (!leaderUserRole && parentDepartmentLeaderId) {
      const leaderUser = await prisma.user.findUnique({
        where: { id: parentDepartmentLeaderId },
        select: { role: true }
      })
      leaderUserRole = leaderUser?.role
    }

    const isParentTlAdmin = (parentDepartmentLeaderId && parentDepartmentLeaderId === session.user.id && isActuallyAdmin) ||
      (parentDept?.id && ledDepartmentIds.includes(parentDept.id) && isActuallyAdmin) ||
      leaderUserRole === "ADMIN"

    const isAssigneeSubTL = !!(subDepartmentLeaderId && task.assignedToId === subDepartmentLeaderId)
    const isAssigneeTL = !!(parentDepartmentLeaderId && task.assignedToId === parentDepartmentLeaderId)

    const needsSubTL = !!task.reviewerId || (isSubDepartment && !!subDepartmentLeaderId && !isAssigneeSubTL) || !!task.subTlApproved
    const needsParentTL = !!task.tlApproved || (!task.reviewerId && !isAssigneeTL && !isParentTlAdmin && !!parentDepartmentLeaderId)

    if (status === "REJECTED") {
      const isReopening = task.status === "COMPLETED"
      const actionLabel = isReopening ? "Re-opened" : "Rejected"

      await prisma.taskComment.create({
        data: {
          taskId: id,
          userId: session.user.id,
          content: isReopening ? `🔄 RE-OPENED: ${reason}` : `❌ REJECTED: ${reason}`
        }
      })

      await logActivity({
        projectId: task.projectId,
        taskId: task.id,
        userId: session.user.id,
        action: isReopening ? "REOPEN_TASK" : "REJECT_TASK",
        details: `${actionLabel}: ${reason}`
      })

      const updatedTask = await prisma.task.update({
        where: { id },
        data: {
          approvalStatus: "REJECTED",
          subTlApproved: false,
          tlApproved: false,
          adminApproved: false,
          subTlApprovalComment: null,
          tlApprovalComment: null,
          adminApprovalComment: null,
          status: "TODO",
          progress: 0,
          actualEnd: null,
          subTlRating: null,
          tlRating: null,
          adminRating: null
        },
        include: {
          project: true,
          assignedTo: { select: { id: true, name: true, role: true, departmentId: true, managerId: true, avatarUrl: true } },
          creator: { select: { id: true, name: true, role: true, avatarUrl: true } },
          comments: {
            include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" }
          },
          department: { select: { id: true, name: true, parentDepartmentId: true, parentDepartment: { select: { id: true, name: true } } } }
        }
      })

      // Notify Assignee
      if (task.assignedToId && task.assignedToId !== session.user.id) {
        await createNotification({
          userId: task.assignedToId,
          title: isReopening ? "Task Re-opened" : "Task Submission Rejected",
          message: `Task "${task.name}" was ${isReopening ? "re-opened" : "rejected"} by ${session.user.name}: "${reason}"`,
          type: "WARNING",
          link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
        }).catch(() => {})
      }

      revalidatePath("/dashboard/projects")
      revalidatePath("/dashboard/projects/reports")
      return { success: true, data: updatedTask }
    }

    // ── Handle Approval (Strict Step-by-Step Processing) ──
    const updateData: any = {}
    const logs: string[] = []

    // Stage 1: Sub-TL or Explicit Reviewer
    const isStage1Active = needsSubTL && !task.subTlApproved
    const canDoStage1 = task.reviewerId ? isExplicitReviewer : isSubTL

    // Stage 2: Parent Team Leader / Dept Head
    const isStage2Active = !isStage1Active && needsParentTL && !task.tlApproved
    const canDoStage2 = isParentTlAdmin ? isActuallyAdmin : (isParentTL || isManager)

    // Stage 3: Admin Final Approval
    const isStage3Active = !isStage1Active && !isStage2Active && !task.adminApproved
    const canDoStage3 = isActuallyAdmin

    if (isStage1Active) {
      if (!canDoStage1 || isAssignee) {
        if (task.reviewerId && !isExplicitReviewer) {
          throw new Error("Reviewer Authority Required: Only the designated Reviewer can approve this stage.")
        }
        throw new Error("Sub-TL Authority Required: Only the designated Sub-Team Leader can approve this stage.")
      }
      updateData.subTlApproved = true
      if (reason) updateData.subTlApprovalComment = reason
      if (rating !== undefined) updateData.subTlRating = rating
      const roleLabel = isExplicitReviewer ? "Reviewer" : "Sub-Team Leader"
      logs.push(`${roleLabel} approved${reason ? `: ${reason}` : ""}`)
    } else if (isStage2Active) {
      if (!canDoStage2 || isAssignee) {
        throw new Error("Team Leader Authority Required: Only the Team Leader can approve this stage.")
      }
      updateData.tlApproved = true
      if (reason) updateData.tlApprovalComment = reason
      if (rating !== undefined) updateData.tlRating = rating
      const roleLabel = isParentTlAdmin ? "Admin (as TL)" : "Team Leader"
      logs.push(`${roleLabel} approved${reason ? `: ${reason}` : ""}`)
    } else if (isStage3Active) {
      if (!canDoStage3) {
        throw new Error("Authority Required: Admin authority required for final approval.")
      }
      updateData.adminApproved = true
      if (reason) updateData.adminApprovalComment = reason
      if (rating !== undefined) updateData.adminRating = rating
      logs.push(`Admin approved${reason ? `: ${reason}` : ""}`)
    } else {
      throw new Error("Invalid Action: Task is already approved or not awaiting approval.")
    }

    // Evaluate final status
    const willBeSubTLApproved = updateData.subTlApproved || task.subTlApproved || !needsSubTL
    const willBeTLApproved = updateData.tlApproved || task.tlApproved || !needsParentTL
    const willBeAdminApproved = updateData.adminApproved || task.adminApproved

    let nextStepMessage = ""

    if (willBeSubTLApproved && willBeTLApproved && willBeAdminApproved) {
      updateData.status = "COMPLETED"
      updateData.approvalStatus = "APPROVED"
      updateData.actualEnd = new Date()
      updateData.progress = 100
      logs.push("Task finalized and marked as Completed")
    } else {
      updateData.approvalStatus = "PENDING"
      updateData.status = "IN_REVIEW"

      if (!willBeSubTLApproved) {
        nextStepMessage = "Waiting for Sub-Team Leader / Reviewer approval"
      } else if (!willBeTLApproved) {
        nextStepMessage = "Waiting for Parent Team Leader approval"
        // Notify Parent TL
        if (parentDepartmentLeaderId && parentDepartmentLeaderId !== session.user.id) {
          await createNotification({
            userId: parentDepartmentLeaderId,
            title: "Task Awaiting Your Approval",
            message: `Task "${task.name}" has been approved by Sub-TL and now requires your approval.`,
            type: "INFO",
            link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
          }).catch(() => {})
        }
      } else if (!willBeAdminApproved) {
        nextStepMessage = "Waiting for Admin final approval"
        // Notify Admins
        const admins = await prisma.user.findMany({ where: { tenantId: session.user.tenantId, role: "ADMIN" }, select: { id: true } })
        const adminNotifications = admins.filter(a => a.id !== session.user.id).map(a => ({
          userId: a.id,
          title: "Task Awaiting Admin Approval",
          message: `Task "${task.name}" has been approved by Team Leader and requires final approval.`,
          type: "INFO",
          link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
        }))
        if (adminNotifications.length > 0) {
          await createManyNotifications(adminNotifications).catch(() => {})
        }
      }
      if (nextStepMessage) logs.push(nextStepMessage)
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { project: true }
    })

    await prisma.taskComment.create({
      data: {
        taskId: id,
        userId: session.user.id,
        content: `✅ APPROVED: ${reason || "Task approved."}`
      }
    })

    await logActivity({
      projectId: updatedTask.projectId,
      taskId: updatedTask.id,
      userId: session.user.id,
      action: "APPROVE_TASK",
      details: logs.join(" · ")
    })

    // If fully completed, notify assignee
    if (updateData.status === "COMPLETED" && task.assignedToId && task.assignedToId !== session.user.id) {
      await createNotification({
        userId: task.assignedToId,
        title: "Task Approved & Completed! 🎉",
        message: `Your task "${task.name}" has received all required approvals and is now marked Completed.`,
        type: "SUCCESS",
        link: `/dashboard/projects/${task.projectId}?taskId=${task.id}`
      }).catch(() => {})
    }

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${updatedTask.projectId}`)
    revalidatePath("/dashboard/projects/reports")

    const finalTask = await prisma.task.findUnique({
      where: { id: updatedTask.id },
      include: {
        project: true,
        assignedTo: { select: { id: true, name: true, role: true, departmentId: true, managerId: true } },
        creator: { select: { id: true, name: true, role: true } },
        comments: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: "asc" }
        },
        department: { select: { id: true, name: true, parentDepartmentId: true, parentDepartment: { select: { id: true, name: true } } } }
      }
    })

    return { success: true, data: finalTask }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getTaskActivity(taskId: string) {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { taskId },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    })
    return { success: true, data: logs }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getMasterTaskReport() {
  try {
    const session = await getSession()
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN"

    const whereClause: any = {}

    // External User Isolation: External users see tasks they created, are assigned to, are designated reviewer on, or are tagged/mentioned in description or comments
    if (isExternalUser(session.user)) {
      whereClause.OR = [
        { createdById: session.user.id },
        { assignedToId: session.user.id },
        { reviewerId: session.user.id },
        { mentionedUserIds: { has: session.user.id } },
        { comments: { some: { mentionedUserIds: { has: session.user.id } } } }
      ]
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: { select: { name: true } },
        department: {
          select: {
            id: true,
            name: true,
            teamLeaderId: true,
            teamLeader: { select: { id: true, name: true } },
            parentDepartmentId: true,
            parentDepartment: {
              select: {
                id: true,
                name: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true } }
              }
            }
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            managerId: true,
            departmentId: true,
            avatarUrl: true,
            department: {
              select: {
                id: true,
                name: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true } },
                parentDepartmentId: true,
                parentDepartment: {
                  select: {
                    id: true,
                    name: true,
                    teamLeaderId: true,
                    teamLeader: { select: { id: true, name: true } }
                  }
                }
              }
            },
            ledDepartments: { select: { id: true } }
          }
        },
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        reviewer: { select: { id: true, name: true, avatarUrl: true, role: true } },
        comments: {
          include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" }
        },
      },
      orderBy: { createdAt: "desc" }
    })

    return { success: true, data: tasks }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getLatestTask(taskId: string) {
  try {
    await getSession()
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        department: {
          select: {
            id: true,
            name: true,
            teamLeaderId: true,
            teamLeader: { select: { id: true, name: true } },
            parentDepartmentId: true,
            parentDepartment: {
              select: {
                id: true,
                name: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true } }
              }
            }
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true,
            departmentId: true,
            managerId: true,
            avatarUrl: true,
            department: {
              select: {
                id: true,
                name: true,
                teamLeaderId: true,
                teamLeader: { select: { id: true, name: true } },
                parentDepartmentId: true,
                parentDepartment: {
                  select: {
                    id: true,
                    name: true,
                    teamLeaderId: true,
                    teamLeader: { select: { id: true, name: true } }
                  }
                }
              }
            },
            ledDepartments: { select: { id: true } }
          }
        },
        creator: { select: { id: true, name: true, role: true, avatarUrl: true } },
        reviewer: { select: { id: true, name: true, avatarUrl: true } },
        comments: {
          include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    })
    return { success: true, data: task }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getAllTasksForMention() {
  try {
    await getSession()
    const tasks = await prisma.task.findMany({
      select: {
        id: true,
        name: true,
        taskNumber: true,
        project: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    })
    return { success: true, data: tasks }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getPerformanceData() {
  try {
    await authorizeProjectManager()

    const projects = await prisma.project.findMany({
      include: {
        tasks: {
          select: { status: true, assignedToId: true, assignedTo: { select: { name: true } } }
        }
      }
    })

    // Calculate project progress
    const projectProgress = projects.map(p => {
      const total = p.tasks.length
      const completed = p.tasks.filter(t => t.status === "COMPLETED").length
      return {
        name: p.name,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0
      }
    })

    // Calculate individual performance
    const performanceMap = new Map()
    projects.forEach(p => {
      p.tasks.forEach(t => {
        if (t.assignedToId && t.assignedTo?.name) {
          const stats = performanceMap.get(t.assignedToId) || { name: t.assignedTo.name, total: 0, completed: 0 }
          stats.total++
          if (t.status === "COMPLETED") stats.completed++
          performanceMap.set(t.assignedToId, stats)
        }
      })
    })

    const individualPerformance = Array.from(performanceMap.values()).map(stats => ({
      name: stats.name,
      efficiency: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      tasks: stats.total
    }))

    // Sort by efficiency
    const sortedPerformance = individualPerformance.sort((a, b) => b.efficiency - a.efficiency).slice(0, 10)

    return {
      success: true,
      data: {
        projectProgress,
        individualPerformance: sortedPerformance
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}