"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasMenuAccess } from "@/lib/permissions"

export async function getSystemConfig() {
  const config = await prisma.systemConfig.upsert({
    where: { id: "GLOBAL_CONFIG" },
    update: {},
    create: {
      id: "GLOBAL_CONFIG",
      defaultOfficeStartTime: "09:30",
      defaultOfficeEndTime: "18:00",
      defaultGraceTimeMinutes: 10,
      lateMarkEnabled: true,
      lateMarkAllowedCount: 3,
      specialCaseEnabled: true,
      specialCaseExtraMinutes: 0,
      specialCaseMaxLateMinutes: 10,
      autoPunchOutEnabled: true,
      autoPunchOutDelayHours: 2,
      autoPunchOutWarningThreshold: 3,
      semiAnnualPolicyEnabled: true,
      semiAnnualCycleStartMonth: 4,
      firstHalfEndTime: "13:30",
      secondHalfStartTime: "13:30",
      earlyLogoffAllowedCount: 3,
      earlyLogoffEnabled: true,
      maxOvertimeHoursPerDay: 4,
      defaultPersonalDriveQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 GB
      maxDriveFileUploadSizeBytes: 100 * 1024 * 1024,         // 100 MB
    },
  })

  return config
}

export async function updateSystemConfig(data: {
  defaultOfficeStartTime: string;
  defaultOfficeEndTime: string;
  defaultGraceTimeMinutes: number;
  lateMarkEnabled: boolean;
  lateMarkAllowedCount: number;
  specialCaseEnabled: boolean;
  specialCaseExtraMinutes: number;
  specialCaseMaxLateMinutes: number;
  autoPunchOutEnabled: boolean;
  autoPunchOutDelayHours: number;
  autoPunchOutWarningThreshold: number;
  semiAnnualPolicyEnabled: boolean;
  semiAnnualCycleStartMonth: number;
  firstHalfEndTime: string;
  secondHalfStartTime: string;
  earlyLogoffAllowedCount: number;
  earlyLogoffEnabled: boolean;
  maxOvertimeHoursPerDay: number;
  defaultPersonalDriveQuotaBytes?: number;
  maxDriveFileUploadSizeBytes?: number;
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/admin/settings", "/dashboard/accountant/settings")) {
    return { error: "Unauthorized access only for administrators and accountants." }
  }

  try {
    const updated = await prisma.systemConfig.update({
      where: { id: "GLOBAL_CONFIG" },
      data: {
        defaultOfficeStartTime: data.defaultOfficeStartTime,
        defaultOfficeEndTime: data.defaultOfficeEndTime,
        defaultGraceTimeMinutes: data.defaultGraceTimeMinutes,
        lateMarkEnabled: data.lateMarkEnabled,
        lateMarkAllowedCount: data.lateMarkAllowedCount,
        specialCaseEnabled: data.specialCaseEnabled,
        specialCaseExtraMinutes: data.specialCaseExtraMinutes,
        specialCaseMaxLateMinutes: data.specialCaseMaxLateMinutes,
        autoPunchOutEnabled: data.autoPunchOutEnabled,
        autoPunchOutDelayHours: data.autoPunchOutDelayHours,
        autoPunchOutWarningThreshold: data.autoPunchOutWarningThreshold,
        semiAnnualPolicyEnabled: data.semiAnnualPolicyEnabled,
        semiAnnualCycleStartMonth: data.semiAnnualCycleStartMonth,
        firstHalfEndTime: data.firstHalfEndTime,
        secondHalfStartTime: data.secondHalfStartTime,
        earlyLogoffAllowedCount: data.earlyLogoffAllowedCount,
        earlyLogoffEnabled: data.earlyLogoffEnabled,
        maxOvertimeHoursPerDay: data.maxOvertimeHoursPerDay,
        ...(data.defaultPersonalDriveQuotaBytes !== undefined && { defaultPersonalDriveQuotaBytes: data.defaultPersonalDriveQuotaBytes }),
        ...(data.maxDriveFileUploadSizeBytes !== undefined && { maxDriveFileUploadSizeBytes: data.maxDriveFileUploadSizeBytes }),
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

