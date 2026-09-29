import { Role } from "@prisma/client"

export interface AuthUser {
  id?: string
  role?: string | Role | null
  roleId?: string | null
  roleName?: string | null
  departmentId?: string | null
  departmentIds?: string[] | null
  ledDepartmentId?: string | null
  ledDepartmentIds?: string[] | null
  isTeamLeader?: boolean | null
  permissions?: string[] | null
  allowedMenus?: string[] | null
  [key: string]: any
}

/**
 * Checks if user is an Administrator (SYSTEM_ADMIN or ADMIN or has 'all' access)
 */
export function isAdminRole(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  return user.role === "ADMIN" || user.role === "SYSTEM_ADMIN" || !!user.allowedMenus?.includes("all")
}

/**
 * Checks if a user is an external collaborator/user.
 * Checks the explicit isExternal boolean flag on user and roleDefinition,
 * as well as role codes and names containing 'external' (case-insensitive)
 * to handle typos or spelling variations when creating roles and permissions.
 */
export function isExternalUser(user?: {
  role?: string | null;
  isExternal?: boolean | null;
  roleName?: string | null;
  roleDefinition?: { code?: string | null; name?: string | null; isExternal?: boolean | null } | null;
  [key: string]: any;
} | null): boolean {
  if (!user) return false;
  if (user.isExternal === true) return true;
  if (user.roleDefinition?.isExternal === true) return true;

  const roleCode = String(user.roleDefinition?.code || user.role || "").toUpperCase().trim();
  const roleName = String(user.roleDefinition?.name || user.roleName || "").toLowerCase().trim();

  if (roleCode === "EXTERNAL_USER" || roleCode === "EXTERNAL") return true;
  if (roleCode.includes("EXTERNAL") || roleName.includes("external")) return true;

  return false;
}

/**
 * Checks if user has access to any of the specified menus/routes or is an Administrator
 */
export function hasMenuAccess(user: AuthUser | null | undefined, ...requiredMenus: string[]): boolean {
  if (!user) return false
  if (isAdminRole(user)) return true
  if (!user.allowedMenus || user.allowedMenus.length === 0) return false

  return requiredMenus.some(reqMenu => {
    const normalizedReq = reqMenu.replace(/\/+$/, "");

    return user.allowedMenus?.some(m => {
      if (m === "all") return true;
      const normalizedMenu = m.replace(/\/+$/, "");

      // Base /dashboard does NOT grant access to sub-features
      if (normalizedMenu === "/dashboard") {
        return normalizedReq === "/dashboard" || normalizedReq === "/dashboard/employee";
      }

      if (normalizedReq === normalizedMenu) return true;
      if (normalizedReq.startsWith(normalizedMenu + "/")) return true;
      if (normalizedMenu.startsWith(normalizedReq + "/")) return true;

      return false;
    });
  });
}

/**
 * Checks whether an incoming URL path is permitted for a user
 */
export function isPathPermittedForUser(
  path: string, 
  allowedMenus: string[] | undefined | null, 
  userRole: string | undefined | null, 
  isTeamLeader: boolean = false
): boolean {
  if (!path) return true;
  const normalizedPath = path.replace(/\/+$/, "") || "/dashboard";

  // External users are blocked from admin project routes, but can access project overview
  const isExternal = isExternalUser({ role: userRole });
  if (isExternal && (normalizedPath.startsWith("/dashboard/projects/activity") || normalizedPath.startsWith("/dashboard/projects/task-master"))) {
    return false;
  }

  // System Admin has full access to all routes
  if (userRole === "SYSTEM_ADMIN") return true;

  // Developer routes are strictly SYSTEM_ADMIN only
  if (normalizedPath.startsWith("/dashboard/admin/developer")) return false;

  // Admin has full access to all non-developer dashboard routes
  if (userRole === "ADMIN" || allowedMenus?.includes("all")) {
    return true;
  }

  // Always accessible base paths
  if (
    normalizedPath === "/dashboard" || 
    normalizedPath === "/dashboard/employee" || 
    normalizedPath === "/dashboard/external" || 
    normalizedPath === "/dashboard/profile" ||
    (!isExternal && (
      normalizedPath === "/dashboard/announcements" || 
      normalizedPath.startsWith("/dashboard/policies") ||
      normalizedPath === "/dashboard/departments"
    ))
  ) {
    return true;
  }

  if (!allowedMenus || allowedMenus.length === 0) {
    return false;
  }

  return allowedMenus.some(menu => {
    if (menu === "all") return true;
    const normalizedMenu = menu.replace(/\/+$/, "");

    if (normalizedMenu === "/dashboard") {
      return normalizedPath === "/dashboard" || normalizedPath === "/dashboard/employee";
    }

    if (normalizedPath === normalizedMenu) return true;
    if (normalizedPath.startsWith(normalizedMenu + "/")) {
      // Sensitive sub-routes require their own explicit menu permission
      if (
        normalizedMenu === "/dashboard/projects" && 
        (normalizedPath.startsWith("/dashboard/projects/task-master") || normalizedPath.startsWith("/dashboard/projects/reports"))
      ) {
        return false;
      }
      if (
        normalizedMenu === "/dashboard/leaves" && 
        normalizedPath.startsWith("/dashboard/leaves/manage")
      ) {
        return false;
      }
      return true;
    }
    return false;
  });
}

/**
 * Checks if user has any of the specified granular action permissions or is an Administrator
 */
export function hasPermission(user: AuthUser | null | undefined, ...permissionKeys: string[]): boolean {
  if (!user) return false
  if (isAdminRole(user)) return true
  if (!user.permissions || user.permissions.length === 0) return false

  return permissionKeys.some(key => user.permissions?.includes(key))
}

/**
 * Centralized permission checker for the application.
 * Use this to avoid repeating isAdmin/isTL logic across pages.
 */
export function getPermissions(user: AuthUser | null | undefined) {
  if (!user) {
    return {
      isAdmin: false,
      isTL: false,
      isMember: false,
      isOnlyMember: false,
      role: null,
      userId: null,
      departmentId: null,
      departmentIds: [] as string[],
      ledDepartmentId: null,
      ledDepartmentIds: [] as string[]
    }
  }

  const isAdmin = isAdminRole(user)
  const isTL = !!user.isTeamLeader || (user.ledDepartmentIds && user.ledDepartmentIds.length > 0) || !!user.ledDepartmentId || isAdmin
  const isMember = !isAdmin
  const isOnlyMember = !isAdmin && !isTL

  const ledDepartmentIds = user.ledDepartmentIds ?? (user.ledDepartmentId ? [user.ledDepartmentId] : [])
  const departmentIds = user.departmentIds ?? (user.departmentId ? [user.departmentId] : [])

  return {
    isAdmin,
    isTL,
    isMember,
    isOnlyMember,
    role: user.role,
    userId: user.id,
    departmentId: user.departmentId,
    departmentIds,
    ledDepartmentId: user.ledDepartmentId,
    ledDepartmentIds
  }
}

/**
 * Specifically handles authority logic for Tasks.
 * Centralizes the check for who can edit, delete, or approve a task.
 */
export function canManageTask(user: AuthUser | null | undefined, task: any, members: any[] = []) {
  const { isAdmin, isTL, userId, departmentId, departmentIds, ledDepartmentIds } = getPermissions(user)
  
  if (!userId) {
    return { 
      hasAuthority: false, 
      canApprove: false,
      canApproveReject: false, 
      canRejectReview: false,
      canReject: false,
      canEditDelete: false, 
      isAssigned: false,
      isCreator: false,
      isDone: false,
      subTlApproved: false,
      tlApproved: false,
      adminApproved: false,
      activeApprovalStage: null as "SUB_TL" | "TL" | "ADMIN" | null,
      canApproveSubTL: false,
      canApproveTL: false,
      canApproveAdmin: false
    }
  }

  const isAssigned = task.assignedToId === userId
  const isDeptMember = members.some(m => m.id === task.assignedToId)
  const isCreator = task.createdById === userId || task.creator?.id === userId
  
  // Extra checks for TL authority: 
  // 1. Task's department matches TL's department or led departments
  // 2. Assignee's department matches TL's department or led departments
  // 3. TL is the manager of the assignee
  const allUserDepts = Array.from(new Set([...(departmentIds || []), ...(departmentId ? [departmentId] : [])]))
  const allLedDepts = ledDepartmentIds || []

  const taskParentDeptId = task.department?.parentDepartmentId || task.assignedTo?.department?.parentDepartmentId
  const taskInMyDept = !!(
    (task.departmentId && (allUserDepts.includes(task.departmentId) || allLedDepts.includes(task.departmentId))) ||
    (taskParentDeptId && (allUserDepts.includes(taskParentDeptId) || allLedDepts.includes(taskParentDeptId)))
  )
  const assigneeDeptId = task.assignedTo?.departmentId
  const assigneeInMyDept = !!(
    (assigneeDeptId && (allUserDepts.includes(assigneeDeptId) || allLedDepts.includes(assigneeDeptId))) ||
    (taskParentDeptId && (allUserDepts.includes(taskParentDeptId) || allLedDepts.includes(taskParentDeptId)))
  )
  const isMySubordinate = task.assignedTo?.managerId === userId

  const isReviewer = !!(task.reviewerId && task.reviewerId === userId)
  const isSystemGenerated = !task.createdById && !task.creator?.id

  // TL Authority for this specific task
  let hasSpecificTLAuthority = false
  if (task.reviewerId) {
    hasSpecificTLAuthority = isReviewer
  } else {
    hasSpecificTLAuthority = isTL && (taskInMyDept || assigneeInMyDept || isMySubordinate || isCreator)
  }

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
  const subDepartmentLeaderId = subDept ? (subDept.teamLeaderId || subDept.teamLeader?.id) : null
  const parentDepartmentLeaderId = parentDept ? (parentDept.teamLeaderId || parentDept.teamLeader?.id) : null

  const leaderMember = members.find((m: any) => m.id === parentDepartmentLeaderId) || parentDept?.teamLeader
  const isParentTlAdmin = (parentDepartmentLeaderId && user?.id === parentDepartmentLeaderId && isAdmin) ||
    (parentDept?.id && ledDepartmentIds.includes(parentDept.id) && isAdmin) ||
    leaderMember?.role === "ADMIN" ||
    leaderMember?.role === "SYSTEM_ADMIN" ||
    parentDept?.teamLeader?.role === "ADMIN" ||
    parentDept?.teamLeader?.role === "SYSTEM_ADMIN"

  const isAssigneeTL = (!!parentDepartmentLeaderId && task.assignedToId === parentDepartmentLeaderId) || (task.assignedTo?.ledDepartmentId && task.assignedTo.ledDepartmentId === parentDept?.id)
  const isAssigneeSubTL = !!(subDepartmentLeaderId && task.assignedToId === subDepartmentLeaderId)
  const isSubTL = !!(subDepartmentLeaderId && user?.id === subDepartmentLeaderId)

  // Stage requirements
  const needsSubTL = !!task.reviewerId || (isSubDepartment && !!subDepartmentLeaderId && !isAssigneeSubTL) || !!task.subTlApproved
  const needsTL = !!task.tlApproved || (!task.reviewerId && !isAssigneeTL && !isParentTlAdmin && !!parentDepartmentLeaderId)

  const isSubTLStagePending = needsSubTL && !task.subTlApproved
  const isTLStagePending = !isSubTLStagePending && needsTL && !task.tlApproved
  const isAdminStagePending = !isSubTLStagePending && !isTLStagePending && !task.adminApproved

  let activeApprovalStage: "SUB_TL" | "TL" | "ADMIN" | null = null
  if (task.status === "IN_REVIEW") {
    if (isSubTLStagePending) activeApprovalStage = "SUB_TL"
    else if (isTLStagePending) activeApprovalStage = "TL"
    else if (isAdminStagePending) activeApprovalStage = "ADMIN"
  }

  const isDone = task.status === "COMPLETED"

  // External User Isolation: External users can ONLY review/approve tasks if they are the designated reviewer
  const isExternal = isExternalUser(user)
  if (isExternal) {
    const canReviewAsReviewer = isReviewer && !isAssigned && isSubTLStagePending && activeApprovalStage === "SUB_TL"
    return {
      hasAuthority: isReviewer || isAssigned || isCreator,
      canApprove: canReviewAsReviewer && task.status === "IN_REVIEW",
      canRejectReview: canReviewAsReviewer && task.status === "IN_REVIEW",
      canReject: (canReviewAsReviewer && task.status === "IN_REVIEW") || (isReviewer && !isAssigned && isDone),
      canEditDelete: (isReviewer || isCreator) && !isDone,
      isAssigned,
      isCreator,
      isDone,
      subTlApproved: !!task.subTlApproved,
      tlApproved: !!task.tlApproved,
      adminApproved: !!task.adminApproved,
      activeApprovalStage,
      canApproveSubTL: canReviewAsReviewer,
      canApproveTL: false,
      canApproveAdmin: false
    }
  }

  // Authority: Admins have full access. Reviewers have access. TLs have access to assigned, dept tasks, or subordinates.
  // Creators always have authority over their tasks.
  // Assignees have authority over system-generated tasks.
  const hasAuthority = isAdmin || 
                       isReviewer ||
                       (isTL && (isAssigned || taskInMyDept || assigneeInMyDept || isMySubordinate || isDeptMember || isCreator)) || 
                       isCreator ||
                       (isSystemGenerated && isAssigned)

  const isParentTL = (parentDepartmentLeaderId && user?.id === parentDepartmentLeaderId) ||
    (parentDept?.id && ledDepartmentIds.includes(parentDept.id)) ||
    (task.assignedTo?.managerId && user?.id === task.assignedTo.managerId && user?.id !== subDepartmentLeaderId)

  const canApproveSubTL = isSubTLStagePending && (
    task.reviewerId
      ? isReviewer
      : isSubTL
  ) && !isAssigned
  const canApproveTL = isTLStagePending && (
    isAdmin || (isParentTL && !isAssigned)
  )
  const canApproveAdmin = isAdmin && isAdminStagePending

  // Can approve current active stage only (strict step-by-step)
  let canApprove = false
  if (task.status === "IN_REVIEW") {
    if (activeApprovalStage === "SUB_TL") {
      canApprove = canApproveSubTL
    } else if (activeApprovalStage === "TL") {
      canApprove = canApproveTL
    } else if (activeApprovalStage === "ADMIN") {
      canApprove = canApproveAdmin
    }
  }

  const canRejectReview = task.status === "IN_REVIEW" && (
    isAdmin || (
      (activeApprovalStage === "SUB_TL" && (isReviewer || isSubTL) && !isAssigned) ||
      (activeApprovalStage === "TL" && isParentTL && !isAssigned)
    )
  )

  // Rejection/Re-opening: 
  // Admins can reject anything in review or completed.
  // TLs can reject if they haven't approved yet, or if it's completed (to re-open).
  const canReject = canRejectReview || (isDone && (isAdmin || (hasSpecificTLAuthority && !isAssigned)))
  const canEditDelete = hasAuthority && !isDone

  return {
    hasAuthority,
    canApprove,
    canRejectReview,
    canReject,
    canEditDelete,
    isAssigned,
    isCreator,
    isDone,
    subTlApproved: !!task.subTlApproved,
    tlApproved: !!task.tlApproved,
    adminApproved: !!task.adminApproved,
    activeApprovalStage,
    canApproveSubTL,
    canApproveTL,
    canApproveAdmin
  }
}
