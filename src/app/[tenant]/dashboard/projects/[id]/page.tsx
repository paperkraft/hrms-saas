import { getProjectTasks } from "@/actions/projects/tasks"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ProjectDetailClient } from "@/components/features/projects/project-detail-client"
import { notFound, redirect } from "next/navigation"
import { isExternalUser } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  const isExternal = isExternalUser(session.user)

  if (isExternal) {
    const isShared = await prisma.projectShare.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId: session.user.id
        }
      }
    })

    if (!isShared) {
      const sp = await searchParams;
      const taskId = typeof sp?.taskId === "string" ? sp.taskId : undefined;
      redirect(taskId ? `/dashboard/projects/reports?taskId=${taskId}` : `/dashboard/projects/reports`);
    }
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      recurringSchedules: {
        include: {
          assignedTo: { select: { id: true, name: true } }
        }
      }
    }
  })

  if (!project) notFound()

  const result = await getProjectTasks(id)
  const tasks = result.success ? result.data : []

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SYSTEM_ADMIN"
  const isAccountant = session?.user?.role === "ACCOUNTANT" || session?.user?.allowedMenus?.includes("/dashboard/accountant")
  const canAccessMilestones = isAdmin || isAccountant

  const milestonesResult = canAccessMilestones
    ? await prisma.milestone.findMany({
        where: { projectId: id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }]
      })
    : []
  const milestones = milestonesResult || []

  const [ledDepts, subordinates, userData] = session?.user?.id ? await Promise.all([
    prisma.department.findMany({
      where: { teamLeaderId: session.user.id },
      include: {
        members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } },
        subDepartments: {
          select: {
            id: true,
            members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } }
          }
        },
        parentDepartment: {
          select: {
            id: true,
            members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } },
            subDepartments: {
              select: {
                id: true,
                members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } }
              }
            }
          }
        }
      }
    }),
    prisma.user.findMany({
      where: {
        ...(session.user.tenantId ? { tenantId: session.user.tenantId } : {}),
        managerId: session.user.id,
        status: "ACTIVE"
      },
      select: { id: true, name: true, email: true, departmentId: true }
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        department: {
          include: {
            members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } },
            subDepartments: {
              select: {
                id: true,
                members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } }
              }
            },
            parentDepartment: {
              select: {
                id: true,
                members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } },
                subDepartments: {
                  select: {
                    id: true,
                    members: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, departmentId: true } }
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
      ...(session.user.tenantId ? { tenantId: session.user.tenantId } : {}),
      status: "ACTIVE"
    },
    select: { id: true, name: true, email: true, departmentId: true, role: true, ledDepartments: { select: { id: true } } }
  })

  const allUsers = rawUsers.map(u => ({
    ...u,
    ledDepartment: u.ledDepartments?.[0] || null,
    ledDepartments: u.ledDepartments
  }))

  let assignableMembers: any[] = allUsers
  if (isExternal) {
    const externalMembersMap = new Map<string, any>()
    externalMembersMap.set(session!.user.id, {
      id: session?.user?.id ?? "",
      name: session?.user?.name ?? null,
      email: session?.user?.email ?? "",
      departmentId: userData?.departmentId ?? null
    })
    if (userData?.department?.members) {
      userData.department.members.forEach((m: any) => externalMembersMap.set(m.id, m))
    }
    assignableMembers = Array.from(externalMembersMap.values())
  } else if (isTL && !isAdmin) {
    const combinedMembersMap = new Map<string, any>()
    
    // Add current user
    combinedMembersMap.set(session!.user.id, { 
      id: session!.user.id, 
      name: session!.user.name ?? null, 
      email: session!.user.email ?? "",
      departmentId: userData?.departmentId ?? null
    })
    
    // Combine parent department members, child department members, and direct subordinates
    ledDepts.forEach((d: any) => {
      d.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
      d.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      if (d.parentDepartment) {
        d.parentDepartment.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
        d.parentDepartment.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      }
    })

    if (userData?.department) {
      userData.department.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
      userData.department.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      if (userData.department.parentDepartment) {
        userData.department.parentDepartment.members?.forEach((m: any) => combinedMembersMap.set(m.id, m))
        userData.department.parentDepartment.subDepartments?.forEach((sub: any) => sub.members?.forEach((m: any) => combinedMembersMap.set(m.id, m)))
      }
    }
    
    subordinates.forEach(sub => combinedMembersMap.set(sub.id, sub))

    assignableMembers = Array.from(combinedMembersMap.values())
  }

  const departments = await prisma.department.findMany({
    include: {
      taskMasters: true,
      parentDepartment: { select: { id: true, name: true } }
    },
    orderBy: { name: 'asc' }
  })

  return (
    <ProjectDetailClient
      project={project as any}
      tasks={tasks as any[]}
      milestones={milestones as any[]}
      recurringSchedules={project.recurringSchedules as any[]}
      isAdmin={isAdmin}
      isAccountant={isAccountant}
      isTL={isTL}
      userDepartment={userData?.departmentId ?? undefined}
      ledDepartment={deptLed?.id ?? undefined}
      ledDepartmentIds={ledDepartmentIds.length > 0 ? ledDepartmentIds : undefined}
      currentUserId={session?.user?.id ?? ""}
      members={assignableMembers as any[]}
      allMembers={allUsers as any[]}
      departments={departments as any[]}
    />
  )
}


