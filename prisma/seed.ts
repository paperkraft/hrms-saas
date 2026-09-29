import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  Role,
  WorkMode,
  EmploymentStatus,
  SubscriptionTier,
  TenantStatus,
  LeaveAccrualType,
} from "@prisma/client";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("==================================================");
  console.log("🌱 STARTING MULTI-TENANT SAAS SEED SCRIPT");
  console.log("==================================================");

  // Common hashed passwords
  const superAdminPassword = await bcrypt.hash("superadmin@123", 10);
  const tenantAdminPassword = await bcrypt.hash("admin@123", 10);
  const employeePassword = await bcrypt.hash("123123", 10);

  // 1. Seed Platform Super Administrator
  console.log("\n👑 1. Seeding Platform Super Admin...");
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@hrms.com";
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: superAdminEmail },
    update: {
      password: superAdminPassword,
      name: "Platform Super Admin",
    },
    create: {
      email: superAdminEmail,
      name: "Platform Super Admin",
      password: superAdminPassword,
    },
  });
  console.log(`✅ Super Admin ready: ${superAdmin.email} (Password: superadmin@123)`);

  // 2. Seed Sigma Tenant
  console.log("\n🏢 2. Seeding Tenant: Sigma Infraplan...");
  const sigmaTenant = await prisma.tenant.upsert({
    where: { slug: "sigma" },
    update: {
      name: "Sigma Infraplan",
      legalName: "SIGMA INFRAPLAN ENGINEERING PVT. LTD.",
      status: TenantStatus.ACTIVE,
      plan: SubscriptionTier.ENTERPRISE,
      maxUsers: 150,
      driveQuotaBytes: 100 * 1024 * 1024 * 1024, // 100 GB
      primaryColor: "#2563eb",
      payrollEnabled: true,
      geofencingEnabled: true,
      driveEnabled: true,
      fileShareEnabled: true,
      taskCommitmentEnabled: true,
    },
    create: {
      slug: "sigma",
      name: "Sigma Infraplan",
      legalName: "SIGMA INFRAPLAN ENGINEERING PVT. LTD.",
      status: TenantStatus.ACTIVE,
      plan: SubscriptionTier.ENTERPRISE,
      maxUsers: 150,
      driveQuotaBytes: 100 * 1024 * 1024 * 1024, // 100 GB
      primaryColor: "#2563eb",
      payrollEnabled: true,
      geofencingEnabled: true,
      driveEnabled: true,
      fileShareEnabled: true,
      taskCommitmentEnabled: true,
    },
  });
  console.log(`✅ Tenant ready: [${sigmaTenant.slug}] ${sigmaTenant.name} (ID: ${sigmaTenant.id})`);

  // 3. Seed Tenant Role Definitions
  console.log("\n🛡️ 3. Seeding Role Definitions for Sigma...");
  const roleDefinitionsData = [
    {
      code: "ADMIN",
      name: "Administrator",
      description: "Full administrative access to all organizational operations.",
      isSystem: true,
      isPayrollEligible: true,
      allowedMenus: [
        "/dashboard",
        "/dashboard/admin",
        "/dashboard/admin/users",
        "/dashboard/admin/departments",
        "/dashboard/admin/locations",
        "/dashboard/admin/roles",
        "/dashboard/admin/settings",
        "/dashboard/admin/settings/leave-policies",
        "/dashboard/leaves/manage",
        "/dashboard/accountant",
        "/dashboard/projects",
        "/dashboard/drive",
      ],
      permissions: ["*"],
    },
    {
      code: "HR",
      name: "Human Resources",
      description: "HR operations, attendance approvals, grievance resolution, and employee profiles.",
      isSystem: true,
      isPayrollEligible: true,
      allowedMenus: [
        "/dashboard",
        "/dashboard/admin/users",
        "/dashboard/leaves/manage",
        "/dashboard/accountant",
        "/dashboard/employee",
        "/dashboard/drive",
      ],
      permissions: ["leaves:manage", "attendance:view", "users:read"],
    },
    {
      code: "ACCOUNTANT",
      name: "Accountant & Finance",
      description: "Financial reconciliations, payroll finalization, and master approvals.",
      isSystem: true,
      isPayrollEligible: true,
      allowedMenus: [
        "/dashboard",
        "/dashboard/accountant",
        "/dashboard/leaves/manage",
        "/dashboard/employee",
        "/dashboard/drive",
      ],
      permissions: ["payroll:manage", "allowances:manage", "leaves:approve"],
    },
    {
      code: "TEAM_LEADER",
      name: "Team Leader",
      description: "Department lead managing tasks, shift times, and project deliverables.",
      isSystem: true,
      isPayrollEligible: true,
      allowedMenus: [
        "/dashboard",
        "/dashboard/projects",
        "/dashboard/employee",
        "/dashboard/drive",
      ],
      permissions: ["tasks:manage", "department:view"],
    },
    {
      code: "EMPLOYEE",
      name: "Standard Employee",
      description: "Standard employee access for self-service attendance, leaves, and tasks.",
      isSystem: true,
      isPayrollEligible: true,
      allowedMenus: [
        "/dashboard",
        "/dashboard/employee",
        "/dashboard/employee/attendance",
        "/dashboard/employee/leaves",
        "/dashboard/projects",
        "/dashboard/drive",
      ],
      permissions: ["self:access"],
    },
  ];

  const roleMap: Record<string, string> = {};
  for (const roleDef of roleDefinitionsData) {
    const created = await prisma.roleDefinition.upsert({
      where: {
        tenantId_code: {
          tenantId: sigmaTenant.id,
          code: roleDef.code,
        },
      },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        allowedMenus: roleDef.allowedMenus,
        permissions: roleDef.permissions,
      },
      create: {
        tenantId: sigmaTenant.id,
        code: roleDef.code,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
        isPayrollEligible: roleDef.isPayrollEligible,
        allowedMenus: roleDef.allowedMenus,
        permissions: roleDef.permissions,
      },
    });
    roleMap[roleDef.code] = created.id;
  }
  console.log(`✅ Seeded ${Object.keys(roleMap).length} Role Definitions.`);

  // 4. Seed SystemConfig for Sigma
  console.log("\n⚙️ 4. Seeding SystemConfig for Sigma...");
  await prisma.systemConfig.upsert({
    where: { tenantId: sigmaTenant.id },
    update: {
      defaultOfficeStartTime: "09:30",
      defaultOfficeEndTime: "18:00",
      defaultGraceTimeMinutes: 10,
      lateMarkEnabled: true,
      lateMarkAllowedCount: 3,
      autoPunchOutEnabled: true,
      autoPunchOutDelayHours: 2,
      autoPunchOutWarningThreshold: 3,
      semiAnnualPolicyEnabled: true,
      semiAnnualCycleStartMonth: 4,
      firstHalfEndTime: "13:30",
      secondHalfStartTime: "13:30",
      leaveNotifyAdmins: true,
      leaveNotifyHr: true,
      leaveNotifyManager: true,
      leaveNotifyTeamLeader: true,
    },
    create: {
      tenantId: sigmaTenant.id,
      defaultOfficeStartTime: "09:30",
      defaultOfficeEndTime: "18:00",
      defaultGraceTimeMinutes: 10,
      lateMarkEnabled: true,
      lateMarkAllowedCount: 3,
      autoPunchOutEnabled: true,
      autoPunchOutDelayHours: 2,
      autoPunchOutWarningThreshold: 3,
      semiAnnualPolicyEnabled: true,
      semiAnnualCycleStartMonth: 4,
      firstHalfEndTime: "13:30",
      secondHalfStartTime: "13:30",
      leaveNotifyAdmins: true,
      leaveNotifyHr: true,
      leaveNotifyManager: true,
      leaveNotifyTeamLeader: true,
    },
  });
  console.log("✅ SystemConfig configured.");

  // 5. Seed Default Leave Policies for Sigma
  console.log("\n🏖️ 5. Seeding Leave Policies for Sigma...");
  const policies = [
    {
      code: "MONTHLY_POLICY_1",
      name: "Monthly Casual / Medical (Policy 1)",
      description: "Standard monthly accrued leaves. 2 days accrued per month with carry-forward & encashment.",
      color: "#2563eb",
      icon: "calendar",
      accrualType: LeaveAccrualType.MONTHLY_ACCRUAL,
      accrualRate: 2.0,
      maxAnnualQuota: 24.0,
      maxCarryForward: 1.0,
      allowEncashment: true,
      allowHalfDay: true,
      allowShortLeave: true,
      probationRestricted: false,
      probationDays: 0,
      minNoticeDaysForAutoApproval: 1,
      requiresApproval: true,
      minConsecutiveDays: 1,
      sandwichRuleEnabled: false,
      isActive: true,
      sortOrder: 1,
    },
    {
      code: "SEMI_ANNUAL_POLICY_2",
      name: "Semi-Annual Medical (Policy 2)",
      description: "Earned/Medical block leave. 3 days per 6-month cycle. Min 3 consecutive working days.",
      color: "#f59e0b",
      icon: "shield-alert",
      accrualType: LeaveAccrualType.SEMI_ANNUAL_CYCLE,
      accrualRate: 3.0,
      maxAnnualQuota: 6.0,
      maxCarryForward: 0.0,
      allowEncashment: false,
      allowHalfDay: false,
      allowShortLeave: false,
      probationRestricted: true,
      probationDays: 90,
      minNoticeDaysForAutoApproval: 7,
      requiresApproval: true,
      minConsecutiveDays: 3,
      sandwichRuleEnabled: false,
      isActive: true,
      sortOrder: 2,
    },
    {
      code: "UNPAID",
      name: "Unpaid Leave (LWP)",
      description: "Leave Without Pay for exceptional personal circumstances.",
      color: "#ef4444",
      icon: "clock",
      accrualType: LeaveAccrualType.ON_DEMAND,
      accrualRate: 0.0,
      maxAnnualQuota: 365.0,
      maxCarryForward: 0.0,
      allowEncashment: false,
      allowHalfDay: true,
      allowShortLeave: false,
      probationRestricted: false,
      probationDays: 0,
      minNoticeDaysForAutoApproval: 0,
      requiresApproval: true,
      minConsecutiveDays: 1,
      sandwichRuleEnabled: false,
      isActive: true,
      sortOrder: 3,
    },
  ];

  for (const pol of policies) {
    await prisma.leavePolicy.upsert({
      where: {
        tenantId_code: {
          tenantId: sigmaTenant.id,
          code: pol.code,
        },
      },
      update: {
        ...pol,
      },
      create: {
        tenantId: sigmaTenant.id,
        ...pol,
      },
    });
  }
  console.log(`✅ Seeded ${policies.length} Leave Policies.`);

  // 6. Seed Location and Departments for Sigma
  console.log("\n📍 6. Seeding Location & Departments...");
  const kolhapurLocation = await prisma.location.upsert({
    where: {
      tenantId_name: {
        tenantId: sigmaTenant.id,
        name: "Kolhapur Headquarters",
      },
    },
    update: {
      startTime: "09:30",
      endTime: "18:00",
      graceTimeMinutes: 10,
      lat: 16.703244,
      lng: 74.253469,
      radiusMeters: 50,
    },
    create: {
      tenantId: sigmaTenant.id,
      name: "Kolhapur Headquarters",
      startTime: "09:30",
      endTime: "18:00",
      graceTimeMinutes: 10,
      lat: 16.703244,
      lng: 74.253469,
      radiusMeters: 50,
    },
  });

  const adminDept = await prisma.department.upsert({
    where: {
      tenantId_name: {
        tenantId: sigmaTenant.id,
        name: "Administration",
      },
    },
    update: { description: "Executive administration and management" },
    create: {
      tenantId: sigmaTenant.id,
      name: "Administration",
      description: "Executive administration and management",
    },
  });

  const civilDept = await prisma.department.upsert({
    where: {
      tenantId_name: {
        tenantId: sigmaTenant.id,
        name: "Civil Engineering",
      },
    },
    update: { description: "Civil engineering, infrastructure design & planning" },
    create: {
      tenantId: sigmaTenant.id,
      name: "Civil Engineering",
      description: "Civil engineering, infrastructure design & planning",
    },
  });

  const softwareDept = await prisma.department.upsert({
    where: {
      tenantId_name: {
        tenantId: sigmaTenant.id,
        name: "Software & Technology",
      },
    },
    update: { description: "Software development and IT infrastructure" },
    create: {
      tenantId: sigmaTenant.id,
      name: "Software & Technology",
      description: "Software development and IT infrastructure",
    },
  });
  console.log("✅ Location and Departments ready.");

  // 7. Seed Sigma Tenant Administrator (Ashish Doshi)
  console.log("\n👤 7. Seeding Sigma Admin & Staff Users...");
  const sigmaAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: sigmaTenant.id,
        email: "admin@sigma.com",
      },
    },
    update: {
      name: "Ashish Doshi",
      password: tenantAdminPassword,
      role: Role.ADMIN,
      roleDefinitionId: roleMap["ADMIN"],
      status: EmploymentStatus.ACTIVE,
      departmentId: adminDept.id,
      locationId: kolhapurLocation.id,
    },
    create: {
      tenantId: sigmaTenant.id,
      name: "Ashish Doshi",
      email: "admin@sigma.com",
      password: tenantAdminPassword,
      role: Role.ADMIN,
      roleDefinitionId: roleMap["ADMIN"],
      status: EmploymentStatus.ACTIVE,
      departmentId: adminDept.id,
      locationId: kolhapurLocation.id,
      joiningDate: new Date("2020-01-01"),
    },
  });

  // Also upsert ashishdoshi@infraplan.in as an admin alias if used
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: sigmaTenant.id,
        email: "ashishdoshi@infraplan.in",
      },
    },
    update: {
      name: "Ashish Doshi",
      password: tenantAdminPassword,
      role: Role.ADMIN,
      roleDefinitionId: roleMap["ADMIN"],
      status: EmploymentStatus.ACTIVE,
      departmentId: adminDept.id,
      locationId: kolhapurLocation.id,
    },
    create: {
      tenantId: sigmaTenant.id,
      name: "Ashish Doshi",
      email: "ashishdoshi@infraplan.in",
      password: tenantAdminPassword,
      role: Role.ADMIN,
      roleDefinitionId: roleMap["ADMIN"],
      status: EmploymentStatus.ACTIVE,
      departmentId: adminDept.id,
      locationId: kolhapurLocation.id,
      joiningDate: new Date("2020-01-01"),
    },
  });
  console.log(`✅ Sigma Admin ready: admin@sigma.com / ashishdoshi@infraplan.in (Password: admin@123)`);

  // 8. Seed HR / Accountant
  const accountant = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: sigmaTenant.id,
        email: "sigma@infraplan.in",
      },
    },
    update: {
      name: "Anuradha Patil",
      password: employeePassword,
      role: Role.EMPLOYEE,
      roleDefinitionId: roleMap["ACCOUNTANT"],
      status: EmploymentStatus.ACTIVE,
      departmentId: adminDept.id,
      managerId: sigmaAdmin.id,
      locationId: kolhapurLocation.id,
    },
    create: {
      tenantId: sigmaTenant.id,
      name: "Anuradha Patil",
      email: "sigma@infraplan.in",
      password: employeePassword,
      role: Role.EMPLOYEE,
      roleDefinitionId: roleMap["ACCOUNTANT"],
      status: EmploymentStatus.ACTIVE,
      departmentId: adminDept.id,
      managerId: sigmaAdmin.id,
      locationId: kolhapurLocation.id,
      joiningDate: new Date("2021-03-01"),
    },
  });
  console.log(`✅ Accountant ready: sigma@infraplan.in (Password: 123123)`);

  // 9. Seed Sample Staff
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: sigmaTenant.id,
        email: "snehalsutar@infraplan.in",
      },
    },
    update: {
      name: "Snehal Sutar",
      password: employeePassword,
      role: Role.EMPLOYEE,
      roleDefinitionId: roleMap["EMPLOYEE"],
      status: EmploymentStatus.ACTIVE,
      departmentId: civilDept.id,
      managerId: sigmaAdmin.id,
      locationId: kolhapurLocation.id,
      workMode: WorkMode.OFFICE,
    },
    create: {
      tenantId: sigmaTenant.id,
      name: "Snehal Sutar",
      email: "snehalsutar@infraplan.in",
      password: employeePassword,
      role: Role.EMPLOYEE,
      roleDefinitionId: roleMap["EMPLOYEE"],
      status: EmploymentStatus.ACTIVE,
      departmentId: civilDept.id,
      managerId: sigmaAdmin.id,
      locationId: kolhapurLocation.id,
      workMode: WorkMode.OFFICE,
      joiningDate: new Date("2022-06-01"),
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: sigmaTenant.id,
        email: "amruta@infraplan.in",
      },
    },
    update: {
      name: "Amruta Kale",
      password: employeePassword,
      role: Role.EMPLOYEE,
      roleDefinitionId: roleMap["EMPLOYEE"],
      status: EmploymentStatus.ACTIVE,
      departmentId: softwareDept.id,
      managerId: sigmaAdmin.id,
      locationId: kolhapurLocation.id,
      workMode: WorkMode.HYBRID,
    },
    create: {
      tenantId: sigmaTenant.id,
      name: "Amruta Kale",
      email: "amruta@infraplan.in",
      password: employeePassword,
      role: Role.EMPLOYEE,
      roleDefinitionId: roleMap["EMPLOYEE"],
      status: EmploymentStatus.ACTIVE,
      departmentId: softwareDept.id,
      managerId: sigmaAdmin.id,
      locationId: kolhapurLocation.id,
      workMode: WorkMode.HYBRID,
      joiningDate: new Date("2023-01-15"),
    },
  });
  console.log("✅ Sample staff seeded (Snehal Sutar, Amruta Kale).");

  // 10. Seed Company Handbook Policies
  console.log("\n📜 10. Seeding Company Workplace Policies...");
  const existingPolicies = await prisma.policy.count({ where: { tenantId: sigmaTenant.id } });
  if (existingPolicies === 0) {
    await prisma.policy.createMany({
      data: [
        {
          tenantId: sigmaTenant.id,
          category: "Workplace Guidelines",
          title: "Standard Working Hours & Hybrid Policy",
          description: "Guidelines regarding core office timings, grace period, and hybrid work mode approvals.",
          content: "<p>Core office timings are <strong>09:30 AM to 06:00 PM</strong> with a 15-minute grace window. Hybrid and remote employees must maintain daily task commitments and punch in accurately through the HRMS mobile or web portal.</p>",
          requirements: ["Daily task check-in by 10:00 AM", "Manager pre-approval for remote work days", "Active attendance punch"],
          lastUpdated: "2026-01-01",
          order: 1,
        },
        {
          tenantId: sigmaTenant.id,
          category: "Code of Conduct",
          title: "Information Security & Data Protection",
          description: "Protocol for managing engineering drawings, project data, and confidential documents.",
          content: "<p>All CAD, project drawings, and financial documentation must be stored strictly within the secure HRMS Drive and Organization Document Repository. Sharing files externally requires appropriate authorization level permissions.</p>",
          requirements: ["Never share root account credentials", "Use expiring file links for external parties", "Report unauthorized access immediately"],
          lastUpdated: "2026-01-15",
          order: 2,
        },
      ],
    });
  }
  console.log("✅ Company policies seeded.");

  console.log("\n==================================================");
  console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
  console.log("\n🔑 CREDENTIALS SUMMARY:");
  console.log("--------------------------------------------------");
  console.log("1. Super Admin Portal (/super-admin/login):");
  console.log("   • Email:    superadmin@hrms.com");
  console.log("   • Password: superadmin@123");
  console.log("\n2. Sigma Tenant Admin Portal (/sigma/dashboard):");
  console.log("   • Email:    admin@sigma.com (or ashishdoshi@infraplan.in)");
  console.log("   • Password: admin@123");
  console.log("\n3. Staff Accounts (/sigma/dashboard):");
  console.log("   • Accountant: sigma@infraplan.in (Password: 123123)");
  console.log("   • Employee:   snehalsutar@infraplan.in (Password: 123123)");
  console.log("   • Employee:   amruta@infraplan.in (Password: 123123)");
  console.log("--------------------------------------------------\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });