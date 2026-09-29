import { minioClient } from "@/lib/minio";
import { DriveScope } from "@prisma/client";

/**
 * Storage Bucket Resolver for Multi-Tenant / Company Isolation
 * 
 * When MINIO_BUCKET_PREFIX is set (e.g. "infraplan"), buckets will be prefixed:
 *   - "infraplan-library"
 *   - "infraplan-project-documents"
 *   - "infraplan-personal-drive"
 *   - "infraplan-ftp-shares"
 *   - "infraplan-hrms"
 * 
 * When MINIO_BUCKET_PREFIX is NOT set, default bucket names are preserved for Sigma:
 *   - "library"
 *   - "project-documents"
 *   - "personal-drive"
 *   - "ftp-shares"
 *   - "hrms"
 */

function sanitizeBucketName(name: string): string {
  // S3 / MinIO bucket naming rules: lowercase, numbers, hyphens, no consecutive dots/hyphens
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getBucketPrefix(): string {
  const prefix = process.env.MINIO_BUCKET_PREFIX || "";
  const cleaned = prefix.trim();
  if (!cleaned) return "";
  return sanitizeBucketName(cleaned);
}

function resolveBucketName(baseName: string, envOverrideKey?: string): string {
  if (envOverrideKey && process.env[envOverrideKey]) {
    return sanitizeBucketName(process.env[envOverrideKey]!);
  }
  const prefix = getBucketPrefix();
  if (prefix) {
    return `${prefix}-${baseName}`;
  }
  return baseName;
}

export function getLibraryBucket(): string {
  return resolveBucketName("library", "MINIO_LIBRARY_BUCKET");
}

export function getProjectDocumentsBucket(): string {
  return resolveBucketName("project-documents", "MINIO_PROJECT_DOCUMENTS_BUCKET");
}

export function getPersonalDriveBucket(): string {
  return resolveBucketName("personal-drive", "MINIO_PERSONAL_DRIVE_BUCKET");
}

export function getFtpBucket(): string {
  return resolveBucketName("ftp-shares", "MINIO_FTP_BUCKET");
}

export function getMainStorageBucket(): string {
  if (process.env.MINIO_BUCKET) {
    // If MINIO_BUCKET is explicitly set, check if prefix should be added or if it's already full name
    const prefix = getBucketPrefix();
    const envVal = process.env.MINIO_BUCKET.trim();
    if (prefix && envVal === "hrms") {
      return `${prefix}-hrms`;
    }
    return sanitizeBucketName(envVal);
  }
  return resolveBucketName("hrms");
}

/**
 * Returns the appropriate bucket name for a given DriveScope
 */
export function getDriveBucket(scope: DriveScope | string): string {
  const upperScope = (scope || "ORGANIZATION_LIBRARY").toUpperCase();
  switch (upperScope) {
    case "PROJECT":
      return getProjectDocumentsBucket();
    case "PERSONAL":
      return getPersonalDriveBucket();
    case "ORGANIZATION_LIBRARY":
    default:
      return getLibraryBucket();
  }
}

/**
 * Returns all drive buckets mapped with their respective DriveScope for scanning / syncing
 */
export function getAllDriveBuckets(): { scope: DriveScope; bucket: string }[] {
  return [
    { scope: DriveScope.ORGANIZATION_LIBRARY, bucket: getLibraryBucket() },
    { scope: DriveScope.PROJECT, bucket: getProjectDocumentsBucket() },
    { scope: DriveScope.PERSONAL, bucket: getPersonalDriveBucket() },
  ];
}

/**
 * Ensures a MinIO bucket exists, creating it if necessary.
 */
export async function ensureBucket(bucketName: string, region = "us-east-1"): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, region);
    }
  } catch (err: any) {
    // If bucket already owned by you or concurrent creation, ignore error
    if (err?.code !== "BucketAlreadyOwnedByYou" && err?.code !== "BucketAlreadyExists") {
      console.error(`[ensureBucket] Error checking/creating bucket "${bucketName}":`, err);
      throw err;
    }
  }
}
