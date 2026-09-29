"use server"

import prisma from "@/lib/prisma"
import { Role } from "@prisma/client"
import { appConfig } from "@/lib/app-config"

export type OrgUser = {
  id: string
  name: string | null
  email: string
  role: Role | string
  roleName?: string | null
  status?: string
  designation: string | null
  avatarUrl: string | null
  departmentId?: string | null
  managerId: string | null
  manager?: {
    id: string
    name: string | null
    email: string
    designation: string | null
    avatarUrl: string | null
    status?: string
  } | null
  department?: {
    id?: string
    name: string
    parentDepartmentId?: string | null
    parentDepartment?: {
      id?: string
      name: string
    } | null
  } | null
  departments?: Array<{
    isPrimary: boolean
    isLeader: boolean
    department: {
      id: string
      name: string
    }
  }>
  ledDepartments?: Array<{
    id: string
    name: string
  }>
}

export type OrgDepartment = {
  id: string
  name: string
  description?: string | null
  parentDepartmentId: string | null
  teamLeaderId: string | null
  teamLeader: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    designation: string | null
    role: Role | string
    status?: string
  } | null
  parentDepartment?: {
    id: string
    name: string
    teamLeader?: {
      id: string
      name: string | null
      email: string
      status?: string
    } | null
  } | null
  members: OrgUser[]
  subDepartments?: OrgDepartment[]
  _count: {
    members: number
    subDepartments: number
  }
}

export type OrgData = {
  users: OrgUser[]
  departments: OrgDepartment[]
}

export async function getOrgData(): Promise<OrgData> {
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { not: 'SYSTEM_ADMIN' },
        status: { notIn: ['RESIGNED', 'TERMINATED'] },
        NOT: [
          { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
          { roleDefinition: { code: 'SYSTEM_ADMIN' } }
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        roleDefinition: {
          select: { name: true, code: true }
        },
        designation: true,
        avatarUrl: true,
        departmentId: true,
        managerId: true,
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            avatarUrl: true,
            status: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            parentDepartmentId: true,
            parentDepartment: {
              select: {
                id: true,
                name: true
              }
            }
          },
        },
        departments: {
          select: {
            isPrimary: true,
            isLeader: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        ledDepartments: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.department.findMany({
      include: {
        teamLeader: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            designation: true,
            role: true,
            status: true
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
                status: true
              }
            }
          }
        },
        members: {
          where: {
            role: { not: 'SYSTEM_ADMIN' },
            status: { notIn: ['RESIGNED', 'TERMINATED'] },
            NOT: [
              { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
              { roleDefinition: { code: 'SYSTEM_ADMIN' } }
            ]
          },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            avatarUrl: true,
            designation: true,
            role: true,
            roleDefinition: {
              select: { name: true, code: true }
            },
            departmentId: true,
            managerId: true,
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
                designation: true,
                avatarUrl: true,
                status: true
              }
            },
            department: {
              select: {
                id: true,
                name: true,
                parentDepartmentId: true,
                parentDepartment: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            departments: {
              select: {
                isPrimary: true,
                isLeader: true,
                department: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            ledDepartments: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { name: 'asc' }
        },
        userDepartments: {
          where: {
            user: {
              role: { not: 'SYSTEM_ADMIN' },
              status: { notIn: ['RESIGNED', 'TERMINATED'] },
              NOT: [
                { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
                { roleDefinition: { code: 'SYSTEM_ADMIN' } }
              ]
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                avatarUrl: true,
                designation: true,
                role: true,
                roleDefinition: {
                  select: { name: true, code: true }
                },
                departmentId: true,
                managerId: true,
                manager: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    designation: true,
                    avatarUrl: true,
                    status: true
                  }
                },
                department: {
                  select: {
                    id: true,
                    name: true,
                    parentDepartmentId: true,
                    parentDepartment: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                },
                departments: {
                  select: {
                    isPrimary: true,
                    isLeader: true,
                    department: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                },
                ledDepartments: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            subDepartments: true,
            userDepartments: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })
  ])

  // Map roleName from roleDefinition if available
  const mappedUsers: OrgUser[] = users.map(u => ({
    ...u,
    status: u.status,
    role: u.roleDefinition?.code || u.role,
    roleName: u.roleDefinition?.name || null
  })) as unknown as OrgUser[]

  const mappedDepartments: OrgDepartment[] = departments.map(d => {
    const memberMap = new Map<string, OrgUser>()

    // 1. Direct members relation (filtered to active/inactive only)
    d.members.forEach((m: any) => {
      if (m.status !== 'RESIGNED' && m.status !== 'TERMINATED') {
        const mapped = {
          ...m,
          status: m.status,
          role: m.roleDefinition?.code || m.role,
          roleName: m.roleDefinition?.name || null
        } as unknown as OrgUser
        memberMap.set(mapped.id, mapped)
      }
    })

    // 2. UserDepartment join table relation
    ;(d as any).userDepartments?.forEach((ud: any) => {
      if (ud.user && ud.user.status !== 'RESIGNED' && ud.user.status !== 'TERMINATED') {
        const mapped = {
          ...ud.user,
          status: ud.user.status,
          role: ud.user.roleDefinition?.code || ud.user.role,
          roleName: ud.user.roleDefinition?.name || null
        } as unknown as OrgUser
        if (!memberMap.has(mapped.id)) {
          memberMap.set(mapped.id, mapped)
        }
      }
    })

    // 3. Global users list matching departmentId or user.departments
    mappedUsers.forEach(u => {
      if (u.status !== 'RESIGNED' && u.status !== 'TERMINATED') {
        const isPrimary = u.departmentId === d.id || u.department?.id === d.id
        const isInUserDepts = u.departments?.some(ud => ud.department?.id === d.id)

        if (isPrimary || isInUserDepts) {
          if (!memberMap.has(u.id)) {
            memberMap.set(u.id, u)
          }
        }
      }
    })

    const allMembers = Array.from(memberMap.values())

    // Handle team leader if resigned/terminated
    const cleanTeamLeader = d.teamLeader && d.teamLeader.status !== 'RESIGNED' && d.teamLeader.status !== 'TERMINATED'
      ? {
          ...d.teamLeader,
          status: d.teamLeader.status
        }
      : null

    const cleanParentDept = d.parentDepartment
      ? {
          ...d.parentDepartment,
          teamLeader: d.parentDepartment.teamLeader && d.parentDepartment.teamLeader.status !== 'RESIGNED' && d.parentDepartment.teamLeader.status !== 'TERMINATED'
            ? d.parentDepartment.teamLeader
            : null
        }
      : null

    return {
      ...d,
      teamLeader: cleanTeamLeader,
      parentDepartment: cleanParentDept,
      members: allMembers,
      _count: {
        ...d._count,
        members: allMembers.length
      }
    }
  }) as unknown as OrgDepartment[]

  return {
    users: mappedUsers,
    departments: mappedDepartments
  }
}
