"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasMenuAccess } from "@/lib/permissions"
import { appConfig } from "@/lib/app-config"


async function authorizeAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error("Unauthorized. Please log in.")
  }
  const user = session.user
  const isAdmin = user.role === "ADMIN" || user.role === "SYSTEM_ADMIN" || user.allowedMenus?.includes("all")
  const hasAdminMenu = user.allowedMenus?.some((m: string) => m === "/dashboard/admin" || m.startsWith("/dashboard/admin/"))
  const hasDeptManagePermission = user.permissions?.includes("departments.manage") || user.permissions?.includes("admin")

  if (!isAdmin && !hasAdminMenu && !hasDeptManagePermission) {
    throw new Error("Unauthorized. Department management permissions required.")
  }
}

export async function getDepartments() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        teamLeader: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          }
        },
        parentDepartment: {
          select: {
            id: true,
            name: true,
            teamLeader: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                status: true,
              }
            }
          }
        },
        _count: {
          select: {
            members: {
              where: {
                status: { notIn: ['RESIGNED', 'TERMINATED'] }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    const sanitizedDepts = departments.map((d: any) => ({
      ...d,
      teamLeader: d.teamLeader?.status && ['RESIGNED', 'TERMINATED'].includes(d.teamLeader.status) ? null : d.teamLeader,
      parentDepartment: d.parentDepartment ? {
        ...d.parentDepartment,
        teamLeader: d.parentDepartment.teamLeader?.status && ['RESIGNED', 'TERMINATED'].includes(d.parentDepartment.teamLeader.status) ? null : d.parentDepartment.teamLeader
      } : null
    }))

    return { success: true, departments: sanitizedDepts }
  } catch (error: any) {
    return { success: false, error: "Failed to fetch departments: " + error.message }
  }
}

export async function updateDepartmentLeader(departmentId: string, leaderId: string | null) {
  try {
    await authorizeAdmin()
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { parentDepartmentId: true, teamLeaderId: true }
    })

    if (!department) {
      return { success: false, error: "Department not found" }
    }

    const previousLeaderId = department.teamLeaderId

    await prisma.department.update({
      where: { id: departmentId },
      data: {
        teamLeaderId: leaderId || null
      }
    })

    if (leaderId) {
      // 1. Ensure leader is associated with this department
      await prisma.user.update({
        where: { id: leaderId },
        data: { departmentId: departmentId }
      })

      // 2. Automatically set this department leader as reporting manager for all department members (excluding leader)
      await prisma.user.updateMany({
        where: {
          departmentId: departmentId,
          id: { not: leaderId }
        },
        data: {
          managerId: leaderId
        }
      })

      // 3. If this is a sub-department and parent department has a leader, set sub-leader's reporting manager to parent leader
      if (department.parentDepartmentId) {
        const parentDept = await prisma.department.findUnique({
          where: { id: department.parentDepartmentId },
          select: { teamLeaderId: true }
        })
        if (parentDept?.teamLeaderId && parentDept.teamLeaderId !== leaderId) {
          await prisma.user.update({
            where: { id: leaderId },
            data: { managerId: parentDept.teamLeaderId }
          })
        }
      }
    } else {
      // If leader was removed, reset managerId for members whose manager was the previous leader
      if (previousLeaderId) {
        await prisma.user.updateMany({
          where: {
            departmentId: departmentId,
            managerId: previousLeaderId
          },
          data: {
            managerId: null
          }
        })
      }
    }

    revalidatePath("/dashboard/departments")
    revalidatePath("/dashboard/org-chart")
    revalidatePath("/dashboard/admin/users")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to update department leader: " + error.message }
  }
}

export async function createDepartment(name: string, parentDepartmentId?: string | null, description?: string | null) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.tenantId) throw new Error("Unauthorized. Please log in.")
    await authorizeAdmin()
    await prisma.department.create({
      data: {
        tenantId: session.user.tenantId,
        name: name.trim(),
        parentDepartmentId: parentDepartmentId || null,
        description: description?.trim() || null
      }
    })
    revalidatePath("/dashboard/departments")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to create department: " + error.message }
  }
}

export async function deleteDepartment(id: string, fallbackDepartmentId?: string) {
  try {
    await authorizeAdmin()

    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            userDepartments: true,
            subDepartments: true
          }
        }
      }
    })

    if (!dept) {
      return { success: false, error: "Department not found." }
    }

    const totalMemberCount = Math.max(dept._count.members, dept._count.userDepartments)

    if (totalMemberCount > 0) {
      if (!fallbackDepartmentId) {
        return {
          success: false,
          error: `This department has ${totalMemberCount} assigned member(s). Please choose a fallback department to transfer them to before deleting.`
        }
      }

      if (fallbackDepartmentId === id) {
        return { success: false, error: "Fallback department cannot be the same department being deleted." }
      }

      const targetDept = await prisma.department.findUnique({
        where: { id: fallbackDepartmentId }
      })

      if (!targetDept) {
        return { success: false, error: "Selected fallback department does not exist." }
      }

      // 1. Reassign primary department for all users
      await prisma.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: fallbackDepartmentId }
      })

      // 2. Reassign UserDepartment join table records
      const userDeptEntries = await prisma.userDepartment.findMany({
        where: { departmentId: id }
      })

      for (const entry of userDeptEntries) {
        const existingInTarget = await prisma.userDepartment.findUnique({
          where: {
            userId_departmentId: {
              userId: entry.userId,
              departmentId: fallbackDepartmentId
            }
          }
        })

        if (!existingInTarget) {
          await prisma.userDepartment.create({
            data: {
              userId: entry.userId,
              departmentId: fallbackDepartmentId,
              isPrimary: entry.isPrimary,
              isLeader: false
            }
          })
        }
      }

      await prisma.userDepartment.deleteMany({
        where: { departmentId: id }
      })

      // 3. Reassign related entities (tasks, templates, announcements, schedules)
      await prisma.task.updateMany({
        where: { departmentId: id },
        data: { departmentId: fallbackDepartmentId }
      })

      await prisma.taskMaster.updateMany({
        where: { departmentId: id },
        data: { departmentId: fallbackDepartmentId }
      })

      await prisma.announcement.updateMany({
        where: { departmentId: id },
        data: { departmentId: fallbackDepartmentId }
      })

      await prisma.recurringTaskSchedule.updateMany({
        where: { departmentId: id },
        data: { departmentId: fallbackDepartmentId }
      })
    } else {
      // Clean up any empty join table records
      await prisma.userDepartment.deleteMany({
        where: { departmentId: id }
      })
    }

    // 4. Handle Sub-departments
    if (dept._count.subDepartments > 0) {
      await prisma.department.updateMany({
        where: { parentDepartmentId: id },
        data: { parentDepartmentId: fallbackDepartmentId || null }
      })
    }

    // 5. Delete the department
    await prisma.department.delete({
      where: { id }
    })

    revalidatePath("/dashboard/departments")
    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/org-chart")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to delete department: " + error.message }
  }
}

export async function getAdminDepartmentsData() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        teamLeader: {
          select: { id: true, name: true, email: true, avatarUrl: true, designation: true, status: true }
        },
        parentDepartment: {
          select: {
            id: true,
            name: true,
            teamLeader: {
              select: { id: true, name: true, email: true, avatarUrl: true, designation: true, status: true }
            }
          }
        },
        members: {
          where: {
            status: { notIn: ['RESIGNED', 'TERMINATED'] },
            NOT: [
              { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
              { roleDefinition: { code: 'SYSTEM_ADMIN' } }
            ]
          },
          select: { id: true, name: true, email: true, avatarUrl: true, designation: true, workMode: true, status: true },
          orderBy: { name: 'asc' }
        },
        userDepartments: {
          where: {
            user: {
              status: { notIn: ['RESIGNED', 'TERMINATED'] },
              NOT: [
                { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
                { roleDefinition: { code: 'SYSTEM_ADMIN' } }
              ]
            }
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, designation: true, workMode: true, status: true }
            }
          }
        },
        subDepartments: {
          select: {
            id: true,
            name: true,
            description: true,
            teamLeaderId: true,
            teamLeader: {
              select: { id: true, name: true, email: true, avatarUrl: true, designation: true, status: true }
            },
            members: {
              where: {
                status: { notIn: ['RESIGNED', 'TERMINATED'] },
                NOT: [
                  { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
                  { roleDefinition: { code: 'SYSTEM_ADMIN' } }
                ]
              },
              select: { id: true, name: true, email: true, avatarUrl: true, designation: true, workMode: true, status: true },
              orderBy: { name: 'asc' }
            },
            userDepartments: {
              where: {
                user: {
                  status: { notIn: ['RESIGNED', 'TERMINATED'] },
                  NOT: [
                    { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
                    { roleDefinition: { code: 'SYSTEM_ADMIN' } }
                  ]
                }
              },
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true, designation: true, workMode: true, status: true }
                }
              }
            }
          }
        },
        _count: { select: { members: true, userDepartments: true } }
      },
      orderBy: { name: 'asc' }
    })

    const processedDepartments = departments.map((dept: any) => {
      const memberMap = new Map<string, any>()
      dept.members.forEach((m: any) => memberMap.set(m.id, m))
      ;(dept.userDepartments || []).forEach((ud: any) => {
        if (ud.user && !memberMap.has(ud.user.id)) {
          memberMap.set(ud.user.id, ud.user)
        }
      })
      const mergedMembers = Array.from(memberMap.values())

      const processedSubDepts = (dept.subDepartments || []).map((sub: any) => {
        const subMemberMap = new Map<string, any>()
        ;(sub.members || []).forEach((m: any) => subMemberMap.set(m.id, m))
        ;(sub.userDepartments || []).forEach((ud: any) => {
          if (ud.user && !subMemberMap.has(ud.user.id)) {
            subMemberMap.set(ud.user.id, ud.user)
          }
        })
        return {
          ...sub,
          teamLeader: sub.teamLeader?.status && ['RESIGNED', 'TERMINATED'].includes(sub.teamLeader.status) ? null : sub.teamLeader,
          members: Array.from(subMemberMap.values())
        }
      })

      return {
        ...dept,
        teamLeader: dept.teamLeader?.status && ['RESIGNED', 'TERMINATED'].includes(dept.teamLeader.status) ? null : dept.teamLeader,
        parentDepartment: dept.parentDepartment ? {
          ...dept.parentDepartment,
          teamLeader: dept.parentDepartment.teamLeader?.status && ['RESIGNED', 'TERMINATED'].includes(dept.parentDepartment.teamLeader.status) ? null : dept.parentDepartment.teamLeader
        } : null,
        members: mergedMembers,
        subDepartments: processedSubDepts,
        _count: {
          ...dept._count,
          members: mergedMembers.length
        }
      }
    })

    const users = await prisma.user.findMany({
      where: {
        status: { notIn: ['RESIGNED', 'TERMINATED'] },
        NOT: [
          { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
          { roleDefinition: { code: 'SYSTEM_ADMIN' } }
        ]
      },
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { name: 'asc' }
    })

    return {
      success: true,
      data: {
        departments: processedDepartments,
        users
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateDepartment(id: string, name: string, parentDepartmentId?: string | null, description?: string | null) {
  try {
    await authorizeAdmin()
    const department = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, parentDepartmentId: true, teamLeaderId: true }
    })

    if (!department) return { success: false, error: "Department not found" }
    if (parentDepartmentId && parentDepartmentId === id) {
      return { success: false, error: "A department cannot be its own parent." }
    }

    if (parentDepartmentId) {
      // Prevent cyclic parent assignment (sub-department cannot become parent of its parent)
      const subDept = await prisma.department.findFirst({
        where: { id: parentDepartmentId, parentDepartmentId: id }
      })
      if (subDept) {
        return { success: false, error: "Cannot set a sub-department as the parent department." }
      }
    }

    const updateData: any = { name: name.trim() }
    if (parentDepartmentId !== undefined) {
      updateData.parentDepartmentId = parentDepartmentId || null
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    await prisma.department.update({
      where: { id },
      data: updateData
    })

    revalidatePath("/dashboard/departments")
    revalidatePath("/dashboard/projects")
    revalidatePath("/dashboard/org-chart")
    revalidatePath("/dashboard/admin/users")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to update department: " + error.message }
  }
}

export async function updateDepartmentMember(
  userId: string,
  departmentId: string | null,
  action: "add" | "remove" = "add"
) {
  try {
    await authorizeAdmin()

    if (action === "add" && departmentId) {
      // Find the department to see if it has a designated team leader
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { teamLeaderId: true }
      })

      const updateData: any = { departmentId }
      // If department has a leader and the user being added is not that leader, assign the leader as reporting manager
      if (dept?.teamLeaderId && dept.teamLeaderId !== userId) {
        updateData.managerId = dept.teamLeaderId
      }

      // Enforce single department placement: update user's primary department
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      })

      // Clean up previous UserDepartment records to guarantee exactly 1 department placement
      await prisma.userDepartment.deleteMany({
        where: { userId }
      })

      await prisma.userDepartment.create({
        data: {
          userId,
          departmentId,
          isPrimary: true,
          isLeader: dept?.teamLeaderId === userId
        }
      })
    } else if (action === "remove") {
      // Unassign user from department if currently placed here
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true, managerId: true }
      })

      const dept = departmentId
        ? await prisma.department.findUnique({
            where: { id: departmentId },
            select: { teamLeaderId: true }
          })
        : null

      const updateData: any = { departmentId: null }
      if (dept?.teamLeaderId && user?.managerId === dept.teamLeaderId) {
        updateData.managerId = null
      }

      if (user?.departmentId === departmentId || !departmentId) {
        await prisma.user.update({
          where: { id: userId },
          data: updateData
        })
      }

      if (departmentId) {
        await prisma.userDepartment.deleteMany({
          where: { userId, departmentId }
        })
      } else {
        await prisma.userDepartment.deleteMany({
          where: { userId }
        })
      }
    }

    revalidatePath("/dashboard/departments")
    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/org-chart")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to update member: " + error.message }
  }
}

export async function syncDepartmentLeadersAsReportingManagers() {
  try {
    await authorizeAdmin()

    // Fetch all departments with their leaders and parent departments
    const departments = await prisma.department.findMany({
      include: {
        parentDepartment: {
          select: { teamLeaderId: true }
        }
      }
    })

    let syncedCount = 0

    for (const dept of departments) {
      if (dept.teamLeaderId) {
        // Set managerId for all members in this department (excluding the leader)
        const res = await prisma.user.updateMany({
          where: {
            departmentId: dept.id,
            id: { not: dept.teamLeaderId }
          },
          data: {
            managerId: dept.teamLeaderId
          }
        })
        syncedCount += res.count

        // If this department is a sub-department and the parent has a leader, link the sub-dept leader to parent leader
        if (dept.parentDepartment?.teamLeaderId && dept.parentDepartment.teamLeaderId !== dept.teamLeaderId) {
          await prisma.user.update({
            where: { id: dept.teamLeaderId },
            data: { managerId: dept.parentDepartment.teamLeaderId }
          })
        }
      }
    }

    revalidatePath("/dashboard/departments")
    revalidatePath("/dashboard/admin/users")
    revalidatePath("/dashboard/org-chart")
    return { success: true, count: syncedCount }
  } catch (error: any) {
    return { success: false, error: "Failed to sync reporting managers: " + error.message }
  }
}

