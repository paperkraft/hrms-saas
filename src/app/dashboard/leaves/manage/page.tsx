import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui";
import { LeavesManageClient } from "@/components/features/leaves/leaves-manage-client";
import { appConfig } from "@/lib/app-config";
import { hasMenuAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Manage Leaves",
  description: "Review, approve, or reject employee leave requests and track department availability.",
};

export default async function ManageLeavesPage({
  searchParams
}: {
  searchParams: Promise<{ m?: string; y?: string }>
}) {
  const params = await searchParams;
  const m = params.m ? parseInt(params.m) : undefined;
  const y = params.y ? parseInt(params.y) : undefined;
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const currentUserId = session.user.id;
  const role = session.user.role;
  const isAdmin = role === "ADMIN" || role === "SYSTEM_ADMIN";
  const isAccountant = role === "ACCOUNTANT";

  // Fetch departments where user is TL
  const ledDepts = await prisma.department.findMany({
    where: { teamLeaderId: currentUserId },
    select: { id: true, parentDepartmentId: true, subDepartments: { select: { id: true } }, parentDepartment: { select: { id: true, subDepartments: { select: { id: true } } } } }
  });

  const ledDeptIdsSet = new Set<string>();
  ledDepts.forEach(d => {
    ledDeptIdsSet.add(d.id);
    d.subDepartments?.forEach((sub: any) => ledDeptIdsSet.add(sub.id));
    if (d.parentDepartment) {
      ledDeptIdsSet.add(d.parentDepartment.id);
      d.parentDepartment.subDepartments?.forEach((sub: any) => ledDeptIdsSet.add(sub.id));
    }
  });
  const ledDeptIds = Array.from(ledDeptIdsSet);
  const isTL = ledDeptIds.length > 0;

  // Check if user is a direct manager to anyone
  const directSubordinatesCount = await prisma.user.count({
    where: { managerId: currentUserId },
  });
  const isManager = directSubordinatesCount > 0;

  // Authorization check: strictly require menu permission
  const isAuthorized = hasMenuAccess(session.user, "/dashboard/leaves/manage");
  if (!isAuthorized) {
    redirect("/dashboard/employee");
  }

  // Fetch all relevant leave requests based on scope
  let requests = [];
  let overtimeRequests = [];

  const currentDate = new Date();
  const currentMonth = m || (currentDate.getMonth() + 1);
  const currentYear = y || currentDate.getFullYear();
  
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  const nonDevUserFilter = {
    role: { not: "SYSTEM_ADMIN" as const },
    NOT: [
      { role: "SYSTEM_ADMIN" as const },
      { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
      { roleDefinition: { code: "SYSTEM_ADMIN" } }
    ]
  };

  const leaveDateFilter = {
    user: nonDevUserFilter,
    OR: [
      { startDate: { gte: startOfMonth, lte: endOfMonth } },
      { endDate: { gte: startOfMonth, lte: endOfMonth } },
      { startDate: { lte: startOfMonth }, endDate: { gte: endOfMonth } },
    ],
  };

  const overtimeDateFilter = {
    user: nonDevUserFilter,
    date: { gte: startOfMonth, lte: endOfMonth },
  };

  if (isAdmin || isAccountant) {
    // Admins and Accountants can see all requests
    requests = await prisma.leaveRequest.findMany({
      where: leaveDateFilter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            avatarUrl: true,
            department: { select: { name: true } },
            manager: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    overtimeRequests = await prisma.overtimeRequest.findMany({
      where: overtimeDateFilter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            designation: true,
            avatarUrl: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    // TLs and Managers see their subordinates or department members
    const memberFilter = {
      OR: [
        { user: { managerId: currentUserId } },
        ...(ledDeptIds.length > 0
          ? [
              { user: { departmentId: { in: ledDeptIds } } },
              { user: { departments: { some: { departmentId: { in: ledDeptIds } } } } }
            ]
          : [])
      ],
    };

    requests = await prisma.leaveRequest.findMany({
      where: {
        AND: [
          leaveDateFilter,
          memberFilter
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            avatarUrl: true,
            department: { select: { name: true } },
            manager: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    overtimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        AND: [
          overtimeDateFilter,
          memberFilter
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            designation: true,
            avatarUrl: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Serialize dates to prevent Next.js serialization warnings
  const serializedRequests = requests.map((req) => ({
    ...req,
    startDate: req.startDate.toISOString(),
    endDate: req.endDate.toISOString(),
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
  }));

  const serializedOvertimeRequests = overtimeRequests.map((req) => ({
    ...req,
    date: req.date.toISOString().split('T')[0], // format as YYYY-MM-DD
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
    employeeName: req.user?.name || "Employee",
    department: req.user?.department?.name || req.user?.designation || "General",
    avatarUrl: req.user?.avatarUrl || null,
    role: req.user?.designation || "Staff Member",
  }));

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      <LeavesManageClient
        key={`${currentYear}-${currentMonth}`}
        initialRequests={serializedRequests}
        initialOvertimeRequests={serializedOvertimeRequests}
        role={role}
        currentUserId={currentUserId}
      />
    </PageContainer>
  );
}
