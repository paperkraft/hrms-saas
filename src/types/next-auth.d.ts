import { Role } from "@prisma/client";
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
      tenantSlug?: string;
      tenantName?: string;
      role: Role | string;
      roleId?: string | null;
      roleName?: string | null;
      departmentId?: string | null;
      departmentIds?: string[];
      ledDepartmentId?: string | null;
      ledDepartmentIds?: string[];
      isTeamLeader: boolean;
      allowedMenus?: string[];
      permissions?: string[];
      isExternal?: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    tenantName?: string;
    role: Role | string;
    roleId?: string | null;
    roleName?: string | null;
    departmentId?: string | null;
    departmentIds?: string[];
    ledDepartmentId?: string | null;
    ledDepartmentIds?: string[];
    isTeamLeader: boolean;
    allowedMenus?: string[];
    permissions?: string[];
    isExternal?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    tenantName?: string;
    role: Role | string;
    roleId?: string | null;
    roleName?: string | null;
    departmentId?: string | null;
    departmentIds?: string[];
    ledDepartmentId?: string | null;
    ledDepartmentIds?: string[];
    isTeamLeader: boolean;
    allowedMenus?: string[];
    permissions?: string[];
    isExternal?: boolean;
  }
}