import prisma from "@/lib/prisma";

export interface UserDriveQuotaInfo {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  usedPercent: number;
  maxFileSizeBytes: number;
  isExceeded: boolean;
}

const DEFAULT_GLOBAL_QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;     // 100 MB

/**
 * Calculates a user's Personal Drive storage usage against their allocated quota.
 */
export async function getUserDriveQuota(userId: string): Promise<UserDriveQuotaInfo> {
  const [user, config, usedAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, driveQuotaBytes: true },
    }),
    prisma.systemConfig.findUnique({
      where: { id: "GLOBAL_CONFIG" },
      select: {
        defaultPersonalDriveQuotaBytes: true,
        maxDriveFileUploadSizeBytes: true,
      },
    }),
    prisma.driveItem.aggregate({
      where: {
        ownerId: userId,
        scope: "PERSONAL",
        type: "FILE",
        isTrashed: false,
      },
      _sum: { size: true },
    }),
  ]);

  const quotaBytes =
    user?.driveQuotaBytes && user.driveQuotaBytes > 0
      ? user.driveQuotaBytes
      : config?.defaultPersonalDriveQuotaBytes || DEFAULT_GLOBAL_QUOTA_BYTES;

  const maxFileSizeBytes =
    config?.maxDriveFileUploadSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES;

  const usedBytes = usedAgg._sum.size || 0;
  const remainingBytes = Math.max(0, quotaBytes - usedBytes);
  const usedPercent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 100;
  const isExceeded = usedBytes >= quotaBytes;

  return {
    usedBytes,
    quotaBytes,
    remainingBytes,
    usedPercent,
    maxFileSizeBytes,
    isExceeded,
  };
}

/**
 * Helper to format bytes into readable string (e.g. 25 MB, 1.5 GB).
 */
export function formatQuotaBytes(bytes: number, decimals = 1): string {
  if (!+bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Pre-upload validator to verify both single file limit and overall personal storage quota.
 */
export async function checkCanUploadToPersonalDrive(
  userId: string,
  incomingSizeBytes: number
): Promise<{
  allowed: boolean;
  error?: string;
  quotaInfo: UserDriveQuotaInfo;
}> {
  const quotaInfo = await getUserDriveQuota(userId);

  // 1. Single File Size Limit Check
  if (incomingSizeBytes > quotaInfo.maxFileSizeBytes) {
    return {
      allowed: false,
      error: `File size (${formatQuotaBytes(incomingSizeBytes)}) exceeds the maximum single file upload limit of ${formatQuotaBytes(quotaInfo.maxFileSizeBytes)}.`,
      quotaInfo,
    };
  }

  // 2. Personal Drive Total Storage Quota Check
  if (quotaInfo.usedBytes + incomingSizeBytes > quotaInfo.quotaBytes) {
    return {
      allowed: false,
      error: `Personal Drive storage quota exceeded! This upload requires ${formatQuotaBytes(incomingSizeBytes)}, but you only have ${formatQuotaBytes(quotaInfo.remainingBytes)} available out of your ${formatQuotaBytes(quotaInfo.quotaBytes)} quota.`,
      quotaInfo,
    };
  }

  return {
    allowed: true,
    quotaInfo,
  };
}
