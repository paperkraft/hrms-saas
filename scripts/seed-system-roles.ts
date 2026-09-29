import "dotenv/config";
import prisma from "../src/lib/prisma";

const SYSTEM_ROLES = [
  {
    code: "SYSTEM_ADMIN",
    name: "System Administrator",
    description: "Full root system control, developer tools, and global management.",
    isSystem: true,
    isPayrollEligible: false,
    isExternal: false,
    allowedMenus: ["all"],
    permissions: ["*"],
  },
  {
    code: "ADMIN",
    name: "Administrator",
    description: "Organization administration, employee management, department setup, and approvals.",
    isSystem: true,
    isPayrollEligible: false,
    isExternal: false,
    allowedMenus: [
      "/dashboard/admin",
      "/dashboard/leaves/manage",
      "/dashboard/admin/users",
      "/dashboard/admin/roles",
      "/dashboard/accountant/location-logs",
      "/dashboard/admin/settings",
      "/dashboard/accountant",
      "/dashboard/projects",
      "/dashboard/projects/reports",
      "/dashboard/projects/task-master",
      "/dashboard/org-chart",
      "/dashboard/departments",
      "/dashboard/announcements",
      "/dashboard/calendar",
      "/dashboard/policies",
      "/dashboard/documents",
      "/dashboard/file-share",
    ],
    permissions: [
      "users.manage",
      "roles.manage",
      "departments.manage",
      "tasks.approve",
      "leaves.approve",
      "attendance.manage",
    ],
  },
  {
    code: "ACCOUNTANT",
    name: "Admin & Accounts",
    description: "Payroll management, salary slips, reimbursements, and financial approvals.",
    isSystem: true,
    isPayrollEligible: true,
    isExternal: false,
    allowedMenus: [
      "/dashboard/employee",
      "/dashboard/employee/attendance",
      "/dashboard/employee/leaves",
      "/dashboard/accountant",
      "/dashboard/accountant/location-logs",
      "/dashboard/accountant/users",
      "/dashboard/accountant/settings",
      "/dashboard/leaves/manage",
      "/dashboard/projects",
      "/dashboard/projects/reports",
      "/dashboard/projects/task-master",
      "/dashboard/org-chart",
      "/dashboard/departments",
      "/dashboard/announcements",
      "/dashboard/calendar",
      "/dashboard/policies",
      "/dashboard/documents",
      "/dashboard/file-share",
    ],
    permissions: ["payroll.manage", "leaves.approve", "salary.view"],
  },
  {
    code: "HR",
    name: "HR",
    description: "Human resources, employee onboarding, attendance & leave oversight, and policies.",
    isSystem: false,
    isPayrollEligible: true,
    isExternal: false,
    allowedMenus: [
      "/dashboard/employee",
      "/dashboard/employee/attendance",
      "/dashboard/employee/leaves",
      "/dashboard/admin/users",
      "/dashboard/leaves/manage",
      "/dashboard/accountant/location-logs",
      "/dashboard/departments",
      "/dashboard/admin/reports",
      "/dashboard/admin/org-chart",
      "/dashboard/projects",
      "/dashboard/projects/reports",
      "/dashboard/org-chart",
      "/dashboard/announcements",
      "/dashboard/calendar",
      "/dashboard/policies",
      "/dashboard/documents",
      "/dashboard/file-share",
    ],
    permissions: [
      "users.manage",
      "leaves.approve",
      "attendance.manage",
      "departments.view",
      "announcements.manage",
      "policies.manage",
    ],
  },
  {
    code: "EMPLOYEE",
    name: "Employee",
    description: "Standard employee workspace, personal attendance, tasks, leaves, and documents.",
    isSystem: true,
    isPayrollEligible: true,
    isExternal: false,
    allowedMenus: [
      "/dashboard/employee",
      "/dashboard/employee/attendance",
      "/dashboard/employee/leaves",
      "/dashboard/org-chart",
      "/dashboard/announcements",
      "/dashboard/calendar",
      "/dashboard/policies",
      "/dashboard/documents",
      "/dashboard/file-share",
      "/dashboard/projects",
      "/dashboard/projects/reports",
    ],
    permissions: ["tasks.view", "leaves.apply", "attendance.punch"],
  },
  {
    code: "EXTERNAL_USER",
    name: "External User",
    description: "External partner/collaborator with dedicated workspace and authorized resource access.",
    isSystem: false,
    isPayrollEligible: false,
    isExternal: true,
    allowedMenus: [
      "/dashboard/external",
      "/dashboard/documents",
      "/dashboard/projects/reports",
    ],
    permissions: ["tasks.view", "documents.view"],
  },
];

async function main() {
  console.log("=== SYNCHRONIZING SYSTEM ROLES & DEPARTMENTS ===");

  // 1. Seed / Upsert System Roles
  console.log("\n1. Upserting RoleDefinition records...");
  const roleMap = new Map<string, string>();

  for (const role of SYSTEM_ROLES) {
    const existing = await prisma.roleDefinition.findUnique({
      where: { code: role.code },
    });

    if (existing) {
      const updated = await prisma.roleDefinition.update({
        where: { code: role.code },
        data: {
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          isPayrollEligible: (role as any).isPayrollEligible !== undefined ? (role as any).isPayrollEligible : existing.isPayrollEligible,
          isExternal: (role as any).isExternal !== undefined ? (role as any).isExternal : existing.isExternal,
          allowedMenus: existing.allowedMenus.length > 0 ? existing.allowedMenus : role.allowedMenus,
          permissions: existing.permissions.length > 0 ? existing.permissions : role.permissions,
        },
      });
      roleMap.set(updated.code, updated.id);
      console.log(`✓ Updated Role: [${updated.code}] ${updated.name} (ID: ${updated.id})`);
    } else {
      const created = await prisma.roleDefinition.create({
        data: {
          code: role.code,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          isPayrollEligible: (role as any).isPayrollEligible !== undefined ? (role as any).isPayrollEligible : true,
          isExternal: (role as any).isExternal ?? false,
          allowedMenus: role.allowedMenus,
          permissions: role.permissions,
        },
      });
      roleMap.set(created.code, created.id);
      console.log(`✓ Created Role: [${created.code}] ${created.name} (ID: ${created.id})`);
    }
  }

  // Ensure system flag is accurate across all role definitions
  const systemCodes = SYSTEM_ROLES.filter(r => r.isSystem).map(r => r.code);
  await prisma.roleDefinition.updateMany({
    where: {
      code: { notIn: systemCodes },
    },
    data: {
      isSystem: false,
    },
  });

  // 2. Sync / Backfill User RoleDefinition links
  console.log("\n2. Linking users to dynamic RoleDefinitions...");
  const users = await prisma.user.findMany();
  let rolesLinked = 0;

  for (const user of users) {
    const targetRoleDefId = roleMap.get(user.role);
    const isExternalUser = user.role === "EXTERNAL_USER" || user.isExternal;

    if (targetRoleDefId && (!user.roleDefinitionId || user.roleDefinitionId !== targetRoleDefId || user.isExternal !== isExternalUser)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          roleDefinitionId: targetRoleDefId,
          ...(isExternalUser ? { isExternal: true } : {}),
        },
      });
      rolesLinked++;
    }
  }
  console.log(`✓ Linked/Verified ${rolesLinked} users to dynamic RoleDefinitions.`);

  // 3. Sync Department Memberships & Team Leaders
  console.log("\n3. Synchronizing UserDepartment memberships & team leaders...");
  const departments = await prisma.department.findMany();
  let userDeptsCreated = 0;

  for (const user of users) {
    // Find all departments this user leads
    const ledDeptIds = departments
      .filter((d) => d.teamLeaderId === user.id)
      .map((d) => d.id);

    // Primary department membership
    if (user.departmentId) {
      const isLeaderOfPrimary = ledDeptIds.includes(user.departmentId);
      await prisma.userDepartment.upsert({
        where: {
          userId_departmentId: {
            userId: user.id,
            departmentId: user.departmentId,
          },
        },
        update: {
          isPrimary: true,
          isLeader: isLeaderOfPrimary,
        },
        create: {
          userId: user.id,
          departmentId: user.departmentId,
          isPrimary: true,
          isLeader: isLeaderOfPrimary,
        },
      });
      userDeptsCreated++;
    }

    // Additional department leadership memberships
    for (const ledDeptId of ledDeptIds) {
      if (ledDeptId !== user.departmentId) {
        await prisma.userDepartment.upsert({
          where: {
            userId_departmentId: {
              userId: user.id,
              departmentId: ledDeptId,
            },
          },
          update: {
            isLeader: true,
          },
          create: {
            userId: user.id,
            departmentId: ledDeptId,
            isPrimary: false,
            isLeader: true,
          },
        });
        userDeptsCreated++;
      }
    }
  }

  console.log(`✓ Synced/Updated ${userDeptsCreated} UserDepartment memberships.`);
  console.log("\n=== SYNCHRONIZATION COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error("Error during synchronization:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
