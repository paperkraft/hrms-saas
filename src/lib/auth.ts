import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { isExternalUser } from "@/lib/permissions";
import { setSuperAdminSessionCookie } from "@/lib/super-admin-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantSlug: { label: "Tenant Slug", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const cleanEmail = credentials.email.toLowerCase().trim();
        const rawSlug = (credentials as any)?.tenantSlug?.toLowerCase()?.trim();
        const tenantSlug = (rawSlug && rawSlug !== "undefined" && rawSlug !== "null" && rawSlug !== "") ? rawSlug : undefined;

        // Find candidate user accounts matching the email
        const candidateUsers = await prisma.user.findMany({
          where: {
            email: { equals: cleanEmail, mode: "insensitive" },
            ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {})
          },
          include: {
            tenant: { select: { id: true, slug: true, name: true, status: true } },
            roleDefinition: true,
            departments: {
              include: {
                department: {
                  select: { id: true, name: true, parentDepartmentId: true }
                }
              }
            }
          }
        });

        let user: (typeof candidateUsers)[0] | null = null;

        for (const candidate of candidateUsers) {
          if (candidate.password) {
            const isMatch = await bcrypt.compare(credentials.password, candidate.password);
            if (isMatch) {
              user = candidate;
              break;
            }
          }
        }

        if (!user) {
          // Check if this is a Platform Super Admin
          const superAdmin = await prisma.superAdmin.findUnique({
            where: { email: cleanEmail },
          });

          if (superAdmin && superAdmin.password) {
            const isSuperValid = await bcrypt.compare(credentials.password, superAdmin.password);
            if (isSuperValid) {
              try {
                await setSuperAdminSessionCookie({
                  id: superAdmin.id,
                  email: superAdmin.email,
                  name: superAdmin.name,
                });
              } catch {}

              return {
                id: superAdmin.id,
                tenantId: "PLATFORM_ROOT",
                tenantSlug: "super-admin",
                tenantName: "HRMS SaaS Platform",
                email: superAdmin.email,
                name: superAdmin.name,
                role: "SUPER_ADMIN",
                roleId: "SUPER_ADMIN",
                roleName: "Super Administrator",
                departmentId: null,
                departmentIds: [],
                ledDepartmentId: null,
                ledDepartmentIds: [],
                isTeamLeader: false,
                allowedMenus: ["all"],
                permissions: ["all"],
                isExternal: false,
                isSuperAdmin: true,
              } as any;
            }
          }
          throw new Error("Invalid email or password");
        }

        if (user.tenant && user.tenant.status === "SUSPENDED") {
          throw new Error("Your organization account is suspended. Please contact support.");
        }

        if (user.status && user.status !== "ACTIVE") {
          if (user.status === "RESIGNED") {
            throw new Error("Your account is marked as resigned. Please contact an administrator.");
          }
          if (user.status === "TERMINATED") {
            throw new Error("Your account has been terminated. Please contact an administrator.");
          }
          if (user.status === "INACTIVE") {
            throw new Error("Your account has been deactivated. Please contact an administrator.");
          }
          throw new Error("Your account has been deactivated. Please contact an administrator.");
        }

        const [teamLeaderDepts, subordinate] = await Promise.all([
          prisma.department.findMany({
            where: {
              OR: [
                { teamLeaderId: user.id },
                { id: { in: user.departments.filter(d => d.isLeader).map(d => d.departmentId) } }
              ]
            },
            select: { id: true, parentDepartmentId: true, subDepartments: { select: { id: true } } }
          }),
          prisma.user.findFirst({
            where: { managerId: user.id },
            select: { id: true }
          })
        ]);

        const ledDepartmentIds = Array.from(new Set(
          teamLeaderDepts.flatMap(dept => [dept.id, ...dept.subDepartments.map(d => d.id)])
        ));
        const primaryLedDept = teamLeaderDepts[0];

        // Roles and permissions are strictly governed by the assigned Role Definition(s)
        const combinedMenus = Array.from(new Set([
          ...(user.roleDefinition?.allowedMenus || []),
          ...((user as any).allowedMenus || []),
        ]));

        // Gather all department IDs the user belongs to
        const departmentIds = user.departments.length > 0
          ? user.departments.map(d => d.departmentId)
          : (user.departmentId ? [user.departmentId] : []);

        const primaryDept = user.departments.find(d => d.isPrimary)?.departmentId || user.departmentId || primaryLedDept?.id || null;

        const effectiveRole = user.roleDefinition?.code || user.role;
        const isExternal = user.isExternal || user.roleDefinition?.isExternal || isExternalUser({ role: effectiveRole, roleName: user.roleDefinition?.name });

        return {
          id: user.id,
          tenantId: user.tenantId,
          tenantSlug: user.tenant?.slug,
          tenantName: user.tenant?.name,
          email: user.email,
          name: user.name,
          role: effectiveRole,
          roleId: user.roleDefinitionId,
          roleName: user.roleDefinition?.name,
          departmentId: primaryDept,
          departmentIds,
          ledDepartmentId: primaryLedDept?.id || null,
          ledDepartmentIds,
          isTeamLeader: teamLeaderDepts.length > 0 || !!subordinate,
          allowedMenus: combinedMenus,
          permissions: user.roleDefinition?.permissions || [],
          isExternal,
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.sub = user.id;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.tenantName = user.tenantName;
        token.role = user.role;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.departmentId = user.departmentId;
        token.departmentIds = user.departmentIds;
        token.ledDepartmentId = user.ledDepartmentId;
        token.ledDepartmentIds = user.ledDepartmentIds;
        token.isTeamLeader = user.isTeamLeader;
        token.allowedMenus = user.allowedMenus;
        token.permissions = user.permissions;
        token.isExternal = user.isExternal;
        token.isSuperAdmin = user.isSuperAdmin || user.role === "SUPER_ADMIN";
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      const userId = token?.id || token?.sub;
      if (userId && session.user) {
        session.user.id = userId;

        if (token.role === "SUPER_ADMIN" || token.isSuperAdmin) {
          session.user.tenantId = "PLATFORM_ROOT";
          session.user.tenantSlug = "super-admin";
          session.user.tenantName = "HRMS SaaS Platform";
          session.user.role = "SUPER_ADMIN";
          session.user.roleId = "SUPER_ADMIN";
          session.user.roleName = "Super Administrator";
          session.user.allowedMenus = ["all"];
          session.user.permissions = ["all"];
          session.user.isExternal = false;
          return session;
        }

        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              status: true,
              role: true,
              roleDefinitionId: true,
              assignedRoleIds: true,
              allowedMenus: true,
              isExternal: true,
              roleDefinition: {
                select: {
                  code: true,
                  name: true,
                  allowedMenus: true,
                  permissions: true,
                  isExternal: true,
                }
              },
              departments: {
                select: { departmentId: true, isPrimary: true, isLeader: true }
              },
              ledDepartments: {
                select: { id: true }
              }
            }
          });

          if (dbUser && dbUser.status && dbUser.status !== "ACTIVE") {
            return null as any;
          }

          if (dbUser) {
            const effectiveRole = dbUser.roleDefinition?.code || dbUser.role;

            const roleIds = (dbUser.assignedRoleIds && dbUser.assignedRoleIds.length > 0)
              ? dbUser.assignedRoleIds
              : (dbUser.roleDefinitionId ? [dbUser.roleDefinitionId] : []);

            let assignedRoleDefs: any[] = [];
            if (roleIds.length > 0) {
              assignedRoleDefs = await prisma.roleDefinition.findMany({
                where: { id: { in: roleIds } },
                select: { allowedMenus: true, permissions: true, code: true, name: true, isExternal: true }
              });
            }

            const combinedMenus = assignedRoleDefs.length > 0
              ? Array.from(new Set(assignedRoleDefs.flatMap(r => r.allowedMenus || [])))
              : Array.from(new Set([
                ...(dbUser.roleDefinition?.allowedMenus || []),
                ...(dbUser.allowedMenus || []),
              ]));

            const combinedPermissions = assignedRoleDefs.length > 0
              ? Array.from(new Set(assignedRoleDefs.flatMap(r => r.permissions || [])))
              : (dbUser.roleDefinition?.permissions || []);

            const isExternal = dbUser.isExternal ||
              dbUser.roleDefinition?.isExternal ||
              assignedRoleDefs.some(r => r.isExternal) ||
              isExternalUser({ role: effectiveRole, roleName: dbUser.roleDefinition?.name });

            const primaryDept = dbUser.departments.find(d => d.isPrimary)?.departmentId || dbUser.departments[0]?.departmentId || null;
            const departmentIds = dbUser.departments.map(d => d.departmentId);
            const ledDepartmentIds = Array.from(new Set([
              ...dbUser.ledDepartments.map(d => d.id),
              ...dbUser.departments.filter(d => d.isLeader).map(d => d.departmentId)
            ]));

            session.user.tenantId = token.tenantId;
            session.user.tenantSlug = token.tenantSlug;
            session.user.tenantName = token.tenantName;
            session.user.role = effectiveRole;
            session.user.roleId = dbUser.roleDefinitionId;
            session.user.roleName = dbUser.roleDefinition?.name;
            session.user.departmentId = primaryDept;
            session.user.departmentIds = departmentIds;
            session.user.ledDepartmentId = ledDepartmentIds[0] || null;
            session.user.ledDepartmentIds = ledDepartmentIds;
            session.user.isTeamLeader = ledDepartmentIds.length > 0;
            session.user.allowedMenus = combinedMenus;
            session.user.permissions = combinedPermissions;
            session.user.isExternal = isExternal;
            return session;
          }
        } catch (err) {
          console.error("Session sync error:", err);
        }

        session.user.tenantId = token.tenantId;
        session.user.tenantSlug = token.tenantSlug;
        session.user.tenantName = token.tenantName;
        session.user.role = token.role;
        session.user.roleId = token.roleId;
        session.user.roleName = token.roleName;
        session.user.departmentId = token.departmentId;
        session.user.departmentIds = token.departmentIds;
        session.user.ledDepartmentId = token.ledDepartmentId;
        session.user.ledDepartmentIds = token.ledDepartmentIds;
        session.user.isTeamLeader = token.isTeamLeader;
        session.user.allowedMenus = token.allowedMenus;
        session.user.permissions = token.permissions;
        session.user.isExternal = token.isExternal ?? false;
      }
      return session;
    }
  }
};