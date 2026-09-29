"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasMenuAccess } from "@/lib/permissions"

export async function getSystemConfig(tenantIdOverride?: string) {
  const session = await getServerSession(authOptions)
  const tenantId = tenantIdOverride || session?.user?.tenantId

  if (!tenantId) {
    return null
  }

  const config = await prisma.systemConfig.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
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
      leaveCustomNotificationEmails: [],
    },
  })

  return config
}

export async function updateSystemConfig(data: {
  defaultOfficeStartTime?: string;
  defaultOfficeEndTime?: string;
  defaultGraceTimeMinutes?: number;
  lateMarkEnabled?: boolean;
  lateMarkAllowedCount?: number;
  specialCaseEnabled?: boolean;
  specialCaseExtraMinutes?: number;
  specialCaseMaxLateMinutes?: number;
  autoPunchOutEnabled?: boolean;
  autoPunchOutDelayHours?: number;
  autoPunchOutWarningThreshold?: number;
  semiAnnualPolicyEnabled?: boolean;
  semiAnnualCycleStartMonth?: number;
  firstHalfEndTime?: string;
  secondHalfStartTime?: string;
  earlyLogoffAllowedCount?: number;
  earlyLogoffEnabled?: boolean;
  maxOvertimeHoursPerDay?: number;
  defaultPersonalDriveQuotaBytes?: number;
  maxDriveFileUploadSizeBytes?: number;
  leaveNotifyAdmins?: boolean;
  leaveNotifyHr?: boolean;
  leaveNotifyManager?: boolean;
  leaveNotifyTeamLeader?: boolean;
  leaveCustomNotificationEmails?: string[];
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session?.user?.tenantId) {
    return { error: "Unauthorized access or no tenant context." }
  }

  const tenantId = session.user.tenantId;

  try {
    const updated = await prisma.systemConfig.upsert({
      where: { tenantId },
      update: {
        ...(data.defaultOfficeStartTime !== undefined && { defaultOfficeStartTime: data.defaultOfficeStartTime }),
        ...(data.defaultOfficeEndTime !== undefined && { defaultOfficeEndTime: data.defaultOfficeEndTime }),
        ...(data.defaultGraceTimeMinutes !== undefined && { defaultGraceTimeMinutes: data.defaultGraceTimeMinutes }),
        ...(data.lateMarkEnabled !== undefined && { lateMarkEnabled: data.lateMarkEnabled }),
        ...(data.lateMarkAllowedCount !== undefined && { lateMarkAllowedCount: data.lateMarkAllowedCount }),
        ...(data.autoPunchOutEnabled !== undefined && { autoPunchOutEnabled: data.autoPunchOutEnabled }),
        ...(data.autoPunchOutDelayHours !== undefined && { autoPunchOutDelayHours: data.autoPunchOutDelayHours }),
        ...(data.autoPunchOutWarningThreshold !== undefined && { autoPunchOutWarningThreshold: data.autoPunchOutWarningThreshold }),
        ...(data.semiAnnualPolicyEnabled !== undefined && { semiAnnualPolicyEnabled: data.semiAnnualPolicyEnabled }),
        ...(data.semiAnnualCycleStartMonth !== undefined && { semiAnnualCycleStartMonth: data.semiAnnualCycleStartMonth }),
        ...(data.firstHalfEndTime !== undefined && { firstHalfEndTime: data.firstHalfEndTime }),
        ...(data.secondHalfStartTime !== undefined && { secondHalfStartTime: data.secondHalfStartTime }),
        ...(data.leaveNotifyAdmins !== undefined && { leaveNotifyAdmins: data.leaveNotifyAdmins }),
        ...(data.leaveNotifyHr !== undefined && { leaveNotifyHr: data.leaveNotifyHr }),
        ...(data.leaveNotifyManager !== undefined && { leaveNotifyManager: data.leaveNotifyManager }),
        ...(data.leaveNotifyTeamLeader !== undefined && { leaveNotifyTeamLeader: data.leaveNotifyTeamLeader }),
        ...(data.leaveCustomNotificationEmails !== undefined && { leaveCustomNotificationEmails: data.leaveCustomNotificationEmails }),
      },
      create: {
        tenantId,
        defaultOfficeStartTime: data.defaultOfficeStartTime || "09:30",
        defaultOfficeEndTime: data.defaultOfficeEndTime || "18:00",
        defaultGraceTimeMinutes: data.defaultGraceTimeMinutes || 10,
        lateMarkEnabled: data.lateMarkEnabled ?? true,
        lateMarkAllowedCount: data.lateMarkAllowedCount || 3,
        autoPunchOutEnabled: data.autoPunchOutEnabled ?? true,
        autoPunchOutDelayHours: data.autoPunchOutDelayHours || 2,
        autoPunchOutWarningThreshold: data.autoPunchOutWarningThreshold || 3,
        semiAnnualPolicyEnabled: data.semiAnnualPolicyEnabled ?? true,
        semiAnnualCycleStartMonth: data.semiAnnualCycleStartMonth || 4,
        firstHalfEndTime: data.firstHalfEndTime || "13:30",
        secondHalfStartTime: data.secondHalfStartTime || "13:30",
        leaveNotifyAdmins: data.leaveNotifyAdmins ?? true,
        leaveNotifyHr: data.leaveNotifyHr ?? true,
        leaveNotifyManager: data.leaveNotifyManager ?? true,
        leaveNotifyTeamLeader: data.leaveNotifyTeamLeader ?? true,
        leaveCustomNotificationEmails: data.leaveCustomNotificationEmails || [],
      },
    })

    revalidatePath("/dashboard/admin/settings")
    revalidatePath("/dashboard/accountant/settings")
    return { success: true, data: updated }
  } catch (error) {
    console.error("Failed to update system config:", error)
    return { error: "Failed to update configuration." }
  }
}

// New action to manage locations
export async function getLocations() {
  return prisma.location.findMany({
    orderBy: { name: 'asc' }
  })
}

export async function upsertLocation(data: {
  id?: string;
  name: string;
  address?: string;
  startTime: string;
  endTime: string;
  lat?: number;
  lng?: number;
  radiusMeters: number;
  graceTimeMinutes: number;
  isRemote: boolean;
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/admin/settings", "/dashboard/accountant/settings")) {
    return { error: "Unauthorized" }
  }

  try {
    if (data.id) {
      const updated = await prisma.location.update({
        where: { id: data.id },
        data: {
          name: data.name,
          address: data.address,
          startTime: data.startTime,
          endTime: data.endTime,
          lat: data.lat,
          lng: data.lng,
          radiusMeters: data.radiusMeters,
          graceTimeMinutes: data.graceTimeMinutes,
          isRemote: data.isRemote,
        }
      })
      revalidatePath("/dashboard/admin/settings")
      revalidatePath("/dashboard/accountant/settings")
      return { success: true, data: updated }
    } else {
      const created = await prisma.location.create({
        data: {
          name: data.name,
          address: data.address,
          startTime: data.startTime,
          endTime: data.endTime,
          lat: data.lat,
          lng: data.lng,
          radiusMeters: data.radiusMeters,
          graceTimeMinutes: data.graceTimeMinutes,
          isRemote: data.isRemote,
        }
      })
      revalidatePath("/dashboard/admin/settings")
      revalidatePath("/dashboard/accountant/settings")
      return { success: true, data: created }
    }
  } catch (error: any) {
    return { error: error.message || "Failed to save location" }
  }
}

export async function deleteLocation(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/admin/settings", "/dashboard/accountant/settings")) {
    return { error: "Unauthorized" }
  }

  try {
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, permittedUsers: true }
        }
      }
    })

    if (!location) {
      return { error: "Location not found" }
    }

    if (location._count.users > 0) {
      return { error: `Cannot delete location. ${location._count.users} employee(s) are assigned to this location as their primary office.` }
    }

    await prisma.location.delete({
      where: { id }
    })

    revalidatePath("/dashboard/admin/settings")
    revalidatePath("/dashboard/accountant/settings")
    return { success: true }
  } catch (error: any) {
    return { error: error.message || "Failed to delete location" }
  }
}

