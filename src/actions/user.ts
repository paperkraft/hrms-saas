"use server"

import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { Role, WorkMode, EmploymentStatus } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ensureBalance } from "./leave/core"
import { hasMenuAccess, isExternalUser } from "@/lib/permissions"

async function authorizeUserManagement() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/admin/users", "/dashboard/accountant/users")) {
    throw new Error("Unauthorized. Required appropriate permissions.")
  }
  return session
}

export async function createUser(data: any) {
  try {
    const session = await authorizeUserManagement()
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const tenantId = data.tenantId || session.user.tenantId;
    if (!tenantId) return { success: false, error: "Tenant ID is required to create a user." };

    // Multi-role resolution: collect all assigned role definitions
    let selectedRoleDefs: any[] = []
    if (Array.isArray(data.roleDefinitionIds) && data.roleDefinitionIds.length > 0) {
      selectedRoleDefs = await prisma.roleDefinition.findMany({
        where: {
          tenantId,
          id: { in: data.roleDefinitionIds }
        }
      })
    } else if (data.roleDefinitionId) {
      const def = await prisma.roleDefinition.findFirst({
        where: {
          tenantId,
          id: data.roleDefinitionId
        }
      })
      if (def) selectedRoleDefs = [def]
    } else if (data.role) {
      const def = await prisma.roleDefinition.findFirst({
        where: {
          tenantId,
          code: data.role
        }
      })
      if (def) selectedRoleDefs = [def]
    }

    const primaryRoleDef = (data.primaryRoleId && selectedRoleDefs.find(r => r.id === data.primaryRoleId))
      || (data.roleDefinitionId && selectedRoleDefs.find(r => r.id === data.roleDefinitionId))
      || selectedRoleDefs[0]
      || null

    const mergedAllowedMenus = Array.from(new Set(
      selectedRoleDefs.flatMap(r => r.allowedMenus || [])
    ))

    const roleEnum: Role = (primaryRoleDef?.code && ['EMPLOYEE', 'ADMIN', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'EXTERNAL_USER'].includes(primaryRoleDef.code))
      ? (primaryRoleDef.code as Role)
      : ((data.role as Role) || 'EMPLOYEE')

    const isExternalUserFlag = data.isExternal !== undefined
      ? Boolean(data.isExternal)
      : isExternalUser({
          role: roleEnum,
          roleDefinition: primaryRoleDef,
          assignedRoleDefs: selectedRoleDefs
        })

    // Determine primary department ID (external users have no department)
    const primaryDeptId = isExternalUserFlag ? null : (data.primaryDepartmentId || data.departmentId || null)

    // If managerId is not explicitly set and primary department has a leader, default managerId to teamLeaderId
    let initialManagerId = data.managerId || null
    if (!initialManagerId && primaryDeptId) {
      const dept = await prisma.department.findUnique({
        where: { id: primaryDeptId },
        select: { teamLeaderId: true }
      })
      if (dept?.teamLeaderId) {
        initialManagerId = dept.teamLeaderId
      }
    }

    const user = await prisma.user.create({
      data: {
        tenantId,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: roleEnum,
        roleDefinitionId: primaryRoleDef?.id || data.roleDefinitionId || null,
        assignedRoleIds: selectedRoleDefs.map(r => r.id),
        allowedMenus: mergedAllowedMenus,
        status: (data.status as EmploymentStatus) || "ACTIVE",
        resignationDate: data.resignationDate || null,
        resignationReason: data.resignationReason || null,
        rejoiningDate: data.rejoiningDate || null,
        designation: data.designation || null,
        managerId: initialManagerId,
        departmentId: primaryDeptId,
        isExternal: isExternalUserFlag,
        locationId: data.locationId || null,
        workMode: (data.workMode as WorkMode) || "OFFICE",
        dateOfBirth: data.dateOfBirth || null,
        joiningDate: data.joiningDate || null,
        minOfficeDays: data.minOfficeDays ? parseInt(data.minOfficeDays) : 0,
        additionalLocations: {
          connect: (data.additionalLocationIds || []).map((id: string) => ({ id }))
        }
      }
    })

    // Enforce single department placement in UserDepartment (skip for external users)
    if (!isExternalUserFlag && primaryDeptId) {
      await prisma.userDepartment.create({
        data: {
          userId: user.id,
          departmentId: primaryDeptId,
          isPrimary: true,
          isLeader: false
        }
      })
    }

    // Assign leadership to specified departments
    if (data.ledDepartmentIds && Array.isArray(data.ledDepartmentIds) && data.ledDepartmentIds.length > 0) {
      await prisma.department.updateMany({
        where: { id: { in: data.ledDepartmentIds } },
        data: { teamLeaderId: user.id }
      })
    }

    // Initialize balance for current month (skip for external users or non-active)
    if (!user.isExternal && user.status === "ACTIVE") {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      await ensureBalance(user.id, currentMonth, currentYear, undefined, tenantId);
    }

    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/accountant/users")
    return { success: true, data: user }
  } catch (error: any) {
    return { success: false, error: "Failed to create user: " + error.message }
  }
}

export async function updateUser(id: string, data: any) {
  try {
    const session = await authorizeUserManagement()
    const tenantId = session?.user?.tenantId

    // Multi-role resolution: collect all assigned role definitions
    let selectedRoleDefs: any[] = []
    if (Array.isArray(data.roleDefinitionIds) && data.roleDefinitionIds.length > 0) {
      selectedRoleDefs = await prisma.roleDefinition.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          id: { in: data.roleDefinitionIds }
        }
      })
    } else if (data.roleDefinitionId) {
      const def = await prisma.roleDefinition.findFirst({
        where: {
          ...(tenantId ? { tenantId } : {}),
          id: data.roleDefinitionId
        }
      })
      if (def) selectedRoleDefs = [def]
    } else if (data.role) {
      const def = await prisma.roleDefinition.findFirst({
        where: {
          ...(tenantId ? { tenantId } : {}),
          code: data.role
        }
      })
      if (def) selectedRoleDefs = [def]
    }

    const primaryRoleDef = (data.primaryRoleId && selectedRoleDefs.find(r => r.id === data.primaryRoleId))
      || (data.roleDefinitionId && selectedRoleDefs.find(r => r.id === data.roleDefinitionId))
      || selectedRoleDefs[0]
      || null

    const mergedAllowedMenus = Array.from(new Set(
      selectedRoleDefs.flatMap(r => r.allowedMenus || [])
    ))

    const roleEnum: Role = (primaryRoleDef?.code && ['EMPLOYEE', 'ADMIN', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'EXTERNAL_USER'].includes(primaryRoleDef.code))
      ? (primaryRoleDef.code as Role)
      : ((data.role as Role) || 'EMPLOYEE')

    const primaryDeptId = data.primaryDepartmentId !== undefined
      ? data.primaryDepartmentId
      : (data.departmentId !== undefined ? data.departmentId : undefined)

    const updateData: any = {
      name: data.name,
      email: data.email,
      role: roleEnum,
      designation: data.designation || null,
      managerId: data.managerId || null,
      locationId: data.locationId || null,
      workMode: (data.workMode as WorkMode) || "OFFICE",
      dateOfBirth: data.dateOfBirth || null,
      joiningDate: data.joiningDate || null,
      minOfficeDays: data.minOfficeDays ? parseInt(data.minOfficeDays) : 0,
      additionalLocations: {
        set: (data.additionalLocationIds || []).map((id: string) => ({ id }))
      }
    }

    if (selectedRoleDefs.length > 0) {
      updateData.roleDefinitionId = primaryRoleDef?.id || null
      updateData.assignedRoleIds = selectedRoleDefs.map(r => r.id)
      updateData.allowedMenus = mergedAllowedMenus
    } else if (data.roleDefinitionId !== undefined) {
      updateData.roleDefinitionId = data.roleDefinitionId || null
      updateData.assignedRoleIds = data.roleDefinitionId ? [data.roleDefinitionId] : []
    }

    if (data.isExternal !== undefined) {
      updateData.isExternal = Boolean(data.isExternal)
    } else if (selectedRoleDefs.length > 0 || roleEnum) {
      updateData.isExternal = isExternalUser({
        role: roleEnum,
        roleDefinition: primaryRoleDef,
        assignedRoleDefs: selectedRoleDefs
      })
    }

    if (updateData.isExternal) {
      updateData.departmentId = null
      await prisma.userDepartment.deleteMany({ where: { userId: id } })
    } else if (primaryDeptId !== undefined) {
      updateData.departmentId = primaryDeptId || null
    }

    if (data.status !== undefined) {
      updateData.status = data.status as EmploymentStatus
    }
    if (data.resignationDate !== undefined) {
      updateData.resignationDate = data.resignationDate
    }
    if (data.resignationReason !== undefined) {
      updateData.resignationReason = data.resignationReason
    }
    if (data.rejoiningDate !== undefined) {
      updateData.rejoiningDate = data.rejoiningDate
    }

    // Only update profile fields if explicitly provided in the form
    if (data.phoneNumber !== undefined && data.phoneNumber !== null) {
      updateData.phoneNumber = data.phoneNumber === "" ? null : data.phoneNumber;
    }
    if (data.bloodGroup !== undefined && data.bloodGroup !== null) {
      updateData.bloodGroup = data.bloodGroup === "" ? null : data.bloodGroup;
    }
    if (data.emergencyContactName !== undefined && data.emergencyContactName !== null) {
      updateData.emergencyContactName = data.emergencyContactName === "" ? null : data.emergencyContactName;
    }
    if (data.emergencyContactPhone !== undefined && data.emergencyContactPhone !== null) {
      updateData.emergencyContactPhone = data.emergencyContactPhone === "" ? null : data.emergencyContactPhone;
    }
    if (data.emergencyContactRelation !== undefined && data.emergencyContactRelation !== null) {
      updateData.emergencyContactRelation = data.emergencyContactRelation === "" ? null : data.emergencyContactRelation;
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    await prisma.user.update({
      where: { id },
      data: updateData
    })

    // 1. Enforce single department placement in UserDepartment
    if (!updateData.isExternal) {
      const targetDeptId = primaryDeptId !== undefined ? (primaryDeptId || null) : updateData.departmentId
      
      // Clean up previous memberships to guarantee only 1 department placement
      await prisma.userDepartment.deleteMany({
        where: { userId: id }
      })

      if (targetDeptId) {
        await prisma.userDepartment.create({
          data: {
            userId: id,
            departmentId: targetDeptId,
            isPrimary: true,
            isLeader: false
          }
        })
      }
    }

    // 2. Multi-Department Leadership handling
    if (data.ledDepartmentIds !== undefined && Array.isArray(data.ledDepartmentIds)) {
      // Clear leadership for departments this user previously led that are no longer selected
      await prisma.department.updateMany({
        where: {
          teamLeaderId: id,
          id: { notIn: data.ledDepartmentIds }
        },
        data: { teamLeaderId: null }
      })

      // Assign leadership for all selected departments
      if (data.ledDepartmentIds.length > 0) {
        await prisma.department.updateMany({
          where: { id: { in: data.ledDepartmentIds } },
          data: { teamLeaderId: id }
        })
      }
    }

    // Initialize/sync balance for current month when user is set to ACTIVE (e.g. rejoining from inactive/maternity leave)
    if (updateData.status === "ACTIVE" && !updateData.isExternal) {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      try {
        await ensureBalance(id, currentMonth, currentYear);
      } catch (err) {
        console.error("Failed to ensure balance on rejoin:", err);
      }
    }

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/accountant/users")
    revalidatePath("/dashboard/accountant")
    revalidatePath("/dashboard/org-chart")
    revalidatePath("/dashboard/departments")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to update user: " + error.message }
  }
}

/**
 * Soft delete / deactivation: marks the user as RESIGNED instead of deleting DB records.
 * Keeps all tasks, projects, documents, payroll, and activity logs active and intact.
 */
export async function deleteUser(id: string) {
  try {
    await authorizeUserManagement()
    // Prevent self-deletion
    const session = await getServerSession(authOptions)
    if (session?.user.id === id) {
      return { success: false, error: "You cannot deactivate your own account." }
    }

    // Soft-deactivate user by setting status to RESIGNED
    await prisma.user.update({
      where: { id },
      data: {
        status: "RESIGNED",
        resignationDate: new Date()
      }
    })

    // Deactivate any active recurring schedules assigned to this user
    await prisma.recurringTaskSchedule.updateMany({
      where: { assignedToId: id, isActive: true },
      data: { isActive: false }
    })

    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/accountant/users")
    revalidatePath("/dashboard/projects")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to deactivate user: " + error.message }
  }
}

/**
 * Permanently deletes a user from the database.
 * Cascades and unlinks all related historical records (tasks, departments, attendances, leaves, files, drive items).
 */
export async function permanentlyDeleteUser(id: string) {
  try {
    await authorizeUserManagement()
    const session = await getServerSession(authOptions)
    
    // 1. Prevent self-deletion
    if (session?.user.id === id) {
      return { success: false, error: "You cannot delete your own account." }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { roleDefinition: true }
    });

    if (!targetUser) {
      return { success: false, error: "User not found." }
    }

    // 2. Prevent non-system-admins from deleting SYSTEM_ADMIN role def
    if (targetUser.roleDefinition?.code === "SYSTEM_ADMIN") {
      if (session?.user.role !== "ADMIN") {
        return { success: false, error: "Only an Administrator can delete a System Administrator account." }
      }
    }

    const adminFallbackId = session?.user.id;

    // 3. Perform cascaded unlinking & deletions
    await prisma.$transaction(async (tx) => {
      // Unlink subordinates
      await tx.user.updateMany({
        where: { managerId: id },
        data: { managerId: null }
      });

      // Unlink department leadership
      await tx.department.updateMany({
        where: { teamLeaderId: id },
        data: { teamLeaderId: null }
      });

      // Join tables
      await tx.userDepartment.deleteMany({ where: { userId: id } });

      // Attendance & Leaves
      await tx.attendance.deleteMany({ where: { userId: id } });
      await tx.attendanceGrievance.deleteMany({ where: { userId: id } });
      await tx.leaveBalance.deleteMany({ where: { userId: id } });
      await tx.leaveRequest.deleteMany({ where: { userId: id } });
      await tx.allowance.deleteMany({ where: { userId: id } });
      await tx.overtimeRequest.deleteMany({ where: { userId: id } });

      // Tasks
      await tx.task.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null }
      });
      if (adminFallbackId) {
        await tx.task.updateMany({
          where: { createdById: id },
          data: { createdById: adminFallbackId }
        });
      }
      await tx.task.updateMany({
        where: { proposedById: id },
        data: { proposedById: null }
      });
      await tx.task.updateMany({
        where: { reviewerId: id },
        data: { reviewerId: null }
      });
      await tx.taskComment.deleteMany({ where: { userId: id } });
      await tx.recurringTaskSchedule.deleteMany({ where: { assignedToId: id } });

      // Drive & Files
      await tx.driveStarredItem.deleteMany({ where: { userId: id } });
      await tx.driveItemPermission.deleteMany({ where: { userId: id } });
      await tx.driveActivity.deleteMany({ where: { userId: id } });
      await tx.driveVersion.deleteMany({ where: { uploadedById: id } });
      await tx.driveItem.deleteMany({ where: { ownerId: id } });
      await tx.driveItem.updateMany({
        where: { lastModifiedById: id },
        data: { lastModifiedById: null }
      });
      await tx.driveItem.updateMany({
        where: { trashedById: id },
        data: { trashedById: null }
      });
      await tx.fileShare.deleteMany({ where: { uploaderId: id } });

      // Announcements & Notifications
      await tx.announcementRead.deleteMany({ where: { userId: id } });
      if (adminFallbackId) {
        await tx.announcement.updateMany({
          where: { createdById: id },
          data: { createdById: adminFallbackId }
        });
      }
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.pushSubscription.deleteMany({ where: { userId: id } });
      await tx.activityLog.deleteMany({ where: { userId: id } });
      await tx.todo.deleteMany({ where: { userId: id } });
      await tx.workloadSnapshot.deleteMany({ where: { userId: id } });

      // Payroll & Salary
      await tx.salaryStructure.deleteMany({ where: { userId: id } });
      await tx.payrollRecord.deleteMany({ where: { userId: id } });

      // Delete User
      await tx.user.delete({ where: { id } });
    });

    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/accountant/users")
    revalidatePath("/dashboard/projects")
    revalidatePath("/dashboard/org-chart")
    return { success: true }
  } catch (error: any) {
    console.error("Permanently delete user error:", error)
    return { success: false, error: "Failed to permanently delete user: " + error.message }
  }
}

/**
 * Manages employment status change (ACTIVE, RESIGNED, INACTIVE, TERMINATED).
 * Supports rehire / rejoining date tracking.
 * Optionally reassigns open tasks to another active employee upon departure.
 */
export async function setUserEmploymentStatus(params: {
  userId: string;
  status: EmploymentStatus;
  resignationDate?: Date | null;
  resignationReason?: string | null;
  rejoiningDate?: Date | null;
  reassignTasksToId?: string | null;
}) {
  try {
    await authorizeUserManagement()
    const session = await getServerSession(authOptions)
    if (session?.user.id === params.userId && params.status !== "ACTIVE") {
      return { success: false, error: "You cannot deactivate your own account." }
    }

    const updatePayload: any = {
      status: params.status,
    }

    if (params.status === "RESIGNED" || params.status === "INACTIVE" || params.status === "TERMINATED") {
      updatePayload.resignationDate = params.resignationDate ?? new Date();
      updatePayload.resignationReason = params.resignationReason || null;
    } else if (params.status === "ACTIVE") {
      updatePayload.resignationDate = null;
      if (params.rejoiningDate) {
        updatePayload.rejoiningDate = params.rejoiningDate;
      }
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: updatePayload
    })

    // If reactivated, ensure leave balance is available for current month
    if (params.status === "ACTIVE" && !updatedUser.isExternal) {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      await ensureBalance(updatedUser.id, currentMonth, currentYear);
    }

    // If reassigning tasks to another user
    if (params.reassignTasksToId && (params.status === "RESIGNED" || params.status === "INACTIVE" || params.status === "TERMINATED")) {
      await prisma.task.updateMany({
        where: {
          assignedToId: params.userId,
          status: { not: "COMPLETED" }
        },
        data: {
          assignedToId: params.reassignTasksToId
        }
      })
    }

    // If deactivated, disable recurring schedules for this user
    if (params.status !== "ACTIVE") {
      await prisma.recurringTaskSchedule.updateMany({
        where: { assignedToId: params.userId, isActive: true },
        data: { isActive: false }
      })
    }

    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/accountant/users")
    revalidatePath("/dashboard/projects")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to update employment status: " + error.message }
  }
}

export async function updateSelfProfile(data: { 
  phoneNumber?: string; 
  bloodGroup?: string;
  emergencyContactName?: string; 
  emergencyContactPhone?: string; 
  emergencyContactRelation?: string;
  password?: string; 
  dateOfBirth?: Date; 
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error("Unauthorized")

    const updateData: any = {}
    if (data.phoneNumber !== undefined && data.phoneNumber !== null) updateData.phoneNumber = data.phoneNumber === "" ? null : data.phoneNumber;
    if (data.bloodGroup !== undefined && data.bloodGroup !== null) updateData.bloodGroup = data.bloodGroup === "" ? null : data.bloodGroup;
    if (data.emergencyContactName !== undefined && data.emergencyContactName !== null) updateData.emergencyContactName = data.emergencyContactName === "" ? null : data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined && data.emergencyContactPhone !== null) updateData.emergencyContactPhone = data.emergencyContactPhone === "" ? null : data.emergencyContactPhone;
    if (data.emergencyContactRelation !== undefined && data.emergencyContactRelation !== null) updateData.emergencyContactRelation = data.emergencyContactRelation === "" ? null : data.emergencyContactRelation;
    if (data.dateOfBirth) updateData.dateOfBirth = data.dateOfBirth
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData
    })

    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function updateUserAvatar(avatarUrl: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error("Unauthorized")

    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl }
    })

    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getUserProfile() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error("Unauthorized")

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        dateOfBirth: true,
        joiningDate: true,
        designation: true,
        phoneNumber: true,
        bloodGroup: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        avatarUrl: true,
      }
    })

    return { success: true, data: user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getAdminUsersData() {
  try {
    const session = await authorizeUserManagement()
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
      return { success: false, error: "Unauthorized: Tenant context is required." };
    }

    const [users, validManagers, departments, locations, roles] = await Promise.all([
      prisma.user.findMany({
        where: {
          tenantId,
          NOT: {
            roleDefinition: {
              code: 'SYSTEM_ADMIN'
            }
          }
        },
        include: {
          manager: true,
          department: true,
          roleDefinition: true,
          departments: {
            include: {
              department: true
            }
          },
          ledDepartments: true,
          location: true,
          additionalLocations: true
        },
        orderBy: [
          { joiningDate: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' }
        ]
      }),
      prisma.user.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          NOT: {
            roleDefinition: {
              code: 'SYSTEM_ADMIN'
            }
          }
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' }
      }),
      prisma.department.findMany({
        where: { tenantId },
        select: { id: true, name: true, teamLeaderId: true },
        orderBy: { name: 'asc' }
      }),
      prisma.location.findMany({
        where: { tenantId },
        select: { id: true, name: true, isRemote: true },
        orderBy: { name: 'asc' }
      }),
      prisma.roleDefinition.findMany({
        where: {
          tenantId,
          code: { not: 'SYSTEM_ADMIN' }
        },
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' }
        ]
      })
    ]);

    return {
      success: true,
      data: {
        users,
        validManagers,
        departments,
        locations,
        roles
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getEmployeesForDropdown() {
  try {
    const session = await getServerSession(authOptions);
    const tenantId = session?.user?.tenantId;

    if (!tenantId) {
      return { success: true, data: [] };
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        NOT: {
          roleDefinition: {
            code: 'SYSTEM_ADMIN'
          }
        }
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' }
    });
    return { success: true, data: users };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

