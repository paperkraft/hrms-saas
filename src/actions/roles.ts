"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

import { hasMenuAccess } from "@/lib/permissions"

async function authorizeRoleManagement() {
  const session = await getServerSession(authOptions)
  if (!session || !hasMenuAccess(session.user, "/dashboard/admin/roles")) {
    throw new Error("Unauthorized. You do not have permission to manage roles.")
  }
}

export async function getRoles() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.tenantId) throw new Error("Unauthorized")

    const tenantId = session.user.tenantId

    const roles = await prisma.roleDefinition.findMany({
      where: {
        tenantId,
        code: { not: 'SYSTEM_ADMIN' }
      },
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ]
    })

    return { success: true, data: roles }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function createRole(data: {
  name: string
  code: string
  description?: string
  allowedMenus?: string[]
  permissions?: string[]
  isPayrollEligible?: boolean
  isExternal?: boolean
}) {
  try {
    await authorizeRoleManagement()
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) {
      return { success: false, error: "Tenant context is required." }
    }
    const tenantId = session.user.tenantId

    if (!data.name || !data.code) {
      return { success: false, error: "Role name and role code are required." }
    }

    const formattedCode = data.code.trim().toUpperCase().replace(/\s+/g, '_')

    // Check if code or name already exists in this tenant
    const existing = await prisma.roleDefinition.findFirst({
      where: {
        tenantId,
        OR: [
          { code: formattedCode },
          { name: data.name.trim() }
        ]
      }
    })

    if (existing) {
      return { success: false, error: "A role with this name or code already exists in this organization." }
    }

    const isExternalComputed = data.isExternal !== undefined 
      ? data.isExternal 
      : (formattedCode.includes('EXTERNAL') || data.name.toLowerCase().includes('external'));

    const newRole = await prisma.roleDefinition.create({
      data: {
        tenantId,
        name: data.name.trim(),
        code: formattedCode,
        description: data.description?.trim() || null,
        isSystem: false,
        isPayrollEligible: data.isPayrollEligible !== undefined ? data.isPayrollEligible : true,
        isExternal: isExternalComputed,
        allowedMenus: data.allowedMenus || [
          '/dashboard',
          '/dashboard/projects',
          '/dashboard/attendance',
          '/dashboard/leaves',
          '/dashboard/announcements',
          '/dashboard/library',
          '/dashboard/drive',
        ],
        permissions: data.permissions || ['tasks.view', 'leaves.apply']
      }
    })

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard/admin/roles")
    revalidatePath("/dashboard/admin/users")
    return { success: true, data: newRole }
  } catch (error: any) {
    return { success: false, error: "Failed to create role: " + error.message }
  }
}

export async function updateRole(
  id: string,
  data: {
    name?: string
    description?: string
    allowedMenus?: string[]
    permissions?: string[]
    isPayrollEligible?: boolean
    isExternal?: boolean
  }
) {
  try {
    await authorizeRoleManagement()
    const session = await getServerSession(authOptions)
    const tenantId = session?.user?.tenantId

    const existing = await prisma.roleDefinition.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {})
      }
    })

    if (!existing) {
      return { success: false, error: "Role not found." }
    }

    const updatePayload: any = {}
    if (data.name !== undefined) updatePayload.name = data.name.trim()
    if (data.description !== undefined) updatePayload.description = data.description.trim()
    if (data.allowedMenus !== undefined) updatePayload.allowedMenus = data.allowedMenus
    if (data.permissions !== undefined) updatePayload.permissions = data.permissions
    if (data.isPayrollEligible !== undefined) updatePayload.isPayrollEligible = data.isPayrollEligible
    if (data.isExternal !== undefined) updatePayload.isExternal = data.isExternal

    const updated = await prisma.roleDefinition.update({
      where: { id },
      data: updatePayload
    })

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard/admin/roles")
    revalidatePath("/dashboard/admin/users")
    return { success: true, data: updated }
  } catch (error: any) {
    return { success: false, error: "Failed to update role: " + error.message }
  }
}

export async function deleteRole(id: string, fallbackRoleId?: string) {
  try {
    await authorizeRoleManagement()
    const session = await getServerSession(authOptions)
    const tenantId = session?.user?.tenantId

    const role = await prisma.roleDefinition.findFirst({
      where: {
        id,
        ...(tenantId ? { tenantId } : {})
      },
      include: {
        _count: { select: { users: true } }
      }
    })

    if (!role) {
      return { success: false, error: "Role not found." }
    }

    if (role.isSystem) {
      return { success: false, error: "System-defined roles cannot be deleted." }
    }

    if (role._count.users > 0) {
      if (!fallbackRoleId) {
        return {
          success: false,
          error: `This role is assigned to ${role._count.users} user(s). Please choose a fallback role to reassign them before deleting.`
        }
      }

      // Reassign users to fallback role
      await prisma.user.updateMany({
        where: { roleDefinitionId: id },
        data: { roleDefinitionId: fallbackRoleId }
      })
    }

    await prisma.roleDefinition.delete({
      where: { id }
    })

    revalidatePath("/dashboard/admin/roles")
    revalidatePath("/dashboard/admin/users")
    return { success: true }
  } catch (error: any) {
    return { success: false, error: "Failed to delete role: " + error.message }
  }
}
