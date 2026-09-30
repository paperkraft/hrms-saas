import { PageContainer } from "@/components/ui"
import { getMasterTaskReport } from "@/actions/projects/tasks"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { MasterTaskReportClient } from "@/components/features/projects/master-task-report-client"
import { isExternalUser } from "@/lib/permissions"

import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function ProjectMasterReportPage() {
  const session = await getServerSession(authOptions)
  const result = await getMasterTaskReport()
  const tasks = result.success && result.data ? result.data : []

  const [ledDepts, subordinates, userData] = session?.user?.id ? await Promise.all([
    prisma.department.findMany({
      where: { teamLeaderId: session.user.id },
      include: {
        members: { select: { id: true, name: true, email: true, departmentId: true } },
        subDepartments: {
          select: {
            id: true,
            members: { select: { id: true, name: true, email: true, departmentId: true } }
          }
        },
        parentDepartment: {
          select: {
            id: true,
            members: { select: { id: true, name: true, email: true, departmentId: true } },
            subDepartments: {
              select: {
                id: true,
                members: { select: { id: true, name: true, email: true, departmentId: true } }
              }
            }
          }
        }
      }
    }),
    prisma.user.findMany({
      where: {
        ...(session?.user?.tenantId ? { tenantId: session.user.tenantId } : {}),
        managerId: session?.user?.id
      },
      select: { id: true, name: true, email: true, departmentId: true }
    }),
    prisma.user.findUnique({
      where: { id: session?.user?.id || "" },
      include: {
        departments: { select: { departmentId: true } },
        department: {
          include: {
            members: { select: { id: true, name: true, email: true, departmentId: true } },
            subDepartments: {
              select: {
                id: true,
                members: { select: { id: true, name: true, email: true, departmentId: true } }
              }
            },
            parentDepartment: {
              select: {
                id: true,
                members: { select: { id: true, name: true, email: true, departmentId: true } },
                subDepartments: {
                  select: {
                    id: true,
                    members: { select: { id: true, name: true, email: true, departmentId: true } }
                  }
                }
              }
            }
          }
        }
      }
    })
  ]) : [[], [], null]

  const deptLed = ledDepts[0] || null
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SYSTEM_ADMIN"
  const isTL = ledDepts.length > 0 || subordinates.length > 0 || !!session?.user?.isTeamLeader

  // Collect all led and family department IDs
  const ledDepartmentIdsSet = new Set<string>()
  ledDepts.forEach((d: any) => {
    ledDepartmentIdsSet.add(d.id)
    d.subDepartments?.forEach((sub: any) => ledDepartmentIdsSet.add(sub.id))
    if (d.parentDepartment) {
      ledDepartmentIdsSet.add(d.parentDepartment.id)
      d.parentDepartment.subDepartments?.forEach((sub: any) => ledDepartmentIdsSet.add(sub.id))
    }
  })
  const ledDepartmentIds = Array.from(ledDepartmentIdsSet)

  const rawUsers = await prisma.user.findMany({
    where: {
      ...(session?.user?.tenantId ? { tenantId: session.user.tenantId } : {}),
      status: "ACTIVE"
    },
    select: { id: true, name: true, email: true, departmentId: true, role: true, ledDepartments: { select: { id: true } } },
    orderBy: { name: 'asc' }
  })

  const allUsers = rawUsers.map(u => ({
    ...u,
    ledDepartment: u.ledDepartments?.[0] || null,
    ledDepartments: u.ledDepartments
  }))

  const isExternal = isExternalUser(session?.user)

  // Combine parent department members, sub-department members and direct subordinates
  let assignableMembers: any[] = allUsers
  if (isExternal) {
    const externalMembersMap = new Map<string, any>()
    externalMembersMap.set(session!.user.id, {
      id: session?.user?.id ?? "",
      name: session?.user?.name ?? null,
      email: session?.user?.email ?? "",
      departmentId: userData?.departmentId ?? null
    })
    // External user: "they will not assign any task to other only if they have a team member in their dept."
    if (userData?.department?.members) {
      userData.department.members.forEach((m: any) => externalMembersMap.set(m.id, m))
    }
    assignableMembers = Array.from(externalMembersMap.values())
  } else if (!isAdmin) {
    const combinedMembersMap = new Map<string, any>()
    
    // Add current user
    combinedMembersMap.set(session!.user.id, {
      id: session?.user?.id ?? "",
      name: session?.user?.name ?? null,
      email: session?.user?.email ?? "",
      departmentId: userData?.departmentId ?? null
    })

    // Add members from led departments (parent + children + parent siblings)
    ledDepts.forEach((d: any) => {
      d.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
      d.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      if (d.parentDepartment) {
        d.parentDepartment.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
        d.parentDepartment.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      }
    })

    // Add members from user's own department family
    if (userData?.department) {
      userData.department.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
      userData.department.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      if (userData.department.parentDepartment) {
        userData.department.parentDepartment.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
        userData.department.parentDepartment.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      }
    }

    // Add direct subordinates
    subordinates.forEach(sub => combinedMembersMap.set(sub.id, sub))

    assignableMembers = Array.from(combinedMembersMap.values())
  }

  let projects: any[] = []
  let departments: any[] = []

  try {
    if (isExternal) {
      const [extProjectResult, sharedProjects] = await Promise.all([
        prisma.project.findFirst({
          where: { name: { equals: "External", mode: "insensitive" } },
          select: { id: true, name: true }
        }),
        prisma.project.findMany({
          where: {
            status: "ACTIVE",
            shares: { some: { userId: session!.user.id } }
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' }
        })
      ])

      let extProject = extProjectResult
      if (!extProject && session?.user?.tenantId) {
        extProject = await prisma.project.create({
          data: {
            tenantId: session.user.tenantId,
            name: "External",
            description: "Dedicated project workspace for external collaborator deliverables and tasks",
            status: "ACTIVE"
          },
          select: { id: true, name: true }
        })
      }

      const projectMap = new Map<string, any>()
      if (extProject) projectMap.set(extProject.id, extProject)
      sharedProjects.forEach(p => projectMap.set(p.id, p))

      projects = Array.from(projectMap.values())

      // Filter departments strictly to only those where the external user is present; hide rest
      const userDeptIds = new Set<string>()
      if (userData?.departmentId) userDeptIds.add(userData.departmentId)
      userData?.departments?.forEach((ud: any) => {
        if (ud.departmentId) userDeptIds.add(ud.departmentId)
      })

      if (userDeptIds.size > 0) {
        departments = await prisma.department.findMany({
          where: {
            id: { in: Array.from(userDeptIds) }
          },
          include: { taskMasters: true, parentDepartment: { select: { id: true, name: true } } },
          orderBy: { name: 'asc' }
        })
      } else {
        departments = []
      }
    } else {
      const [pResult, dResult] = await Promise.all([
        prisma.project.findMany({
          where: {
            ...(session?.user?.tenantId ? { tenantId: session.user.tenantId } : {}),
            status: "ACTIVE"
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' }
        }),
        prisma.department.findMany({
          where: session?.user?.tenantId ? { tenantId: session.user.tenantId } : {},
          include: { taskMasters: true, parentDepartment: { select: { id: true, name: true } } },
          orderBy: { name: 'asc' }
        })
      ])
      projects = pResult
      departments = dResult
    }
  } catch (error) {
    console.error("Error fetching projects/departments:", error)
  }

  return (
    <PageContainer maxWidth="full" className="py-6 space-y-6">
      <MasterTaskReportClient
        tasks={tasks}
        isAdmin={isAdmin}
        isTL={isTL}
        isExternal={isExternal}
        userDepartmentId={userData?.departmentId ?? undefined}
        ledDepartmentId={deptLed?.id ?? undefined}
        ledDepartmentIds={ledDepartmentIds.length > 0 ? ledDepartmentIds : undefined}
        currentUserId={session?.user?.id ?? ""}
        members={assignableMembers as any}
        allMembers={allUsers as any}
        allProjects={projects}
        allDepartments={departments as any}
      />
    </PageContainer>
  )
}
