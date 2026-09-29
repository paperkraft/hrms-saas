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
  const [user, usedAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, driveQuotaBytes: true, tenant: { select: { driveQuotaBytes: true } } },
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
      : DEFAULT_GLOBAL_QUOTA_BYTES;

  const maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES;

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
 * Checks if the user has enough available quota to upload a file of given size.
 */
export async function checkCanUploadToPersonalDrive(userId: string, incomingSizeBytes: number): Promise<{ canUpload: boolean; reason?: string }> {
  const quota = await getUserDriveQuota(userId);
  if (incomingSizeBytes > quota.maxFileSizeBytes) {
    return {
      canUpload: false,
      reason: `File size exceeds the maximum upload limit of ${formatQuotaBytes(quota.maxFileSizeBytes)}.`,
    };
  }
  if (quota.usedBytes + incomingSizeBytes > quota.quotaBytes) {
    return {
      canUpload: false,
      reason: `Personal drive storage quota exceeded. You have ${formatQuotaBytes(quota.remainingBytes)} remaining.`,
    };
  }
  return { canUpload: true };
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
