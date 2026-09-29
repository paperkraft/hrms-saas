import "dotenv/config";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { DriveScope } from "@prisma/client";
import { getAllDriveBuckets } from "@/lib/drive-storage";

export async function runStorageSync() {
  console.log("==================================================");
  console.log("🔄 Starting MinIO Storage Sync Engine (FTP -> Drive)");
  console.log("==================================================");

  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ["SYSTEM_ADMIN", "ADMIN"] } },
    select: { id: true, name: true, email: true },
  });

  if (!adminUser) {
    console.error("❌ No admin user found in database to assign synchronized files.");
    return;
  }

  console.log(`👤 Syncing files under owner: ${adminUser.name} (${adminUser.id})`);

  const inferMimeType = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return "application/pdf";
      case "doc": return "application/msword";
      case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "xls": return "application/vnd.ms-excel";
      case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case "ppt": return "application/vnd.ms-powerpoint";
      case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      case "png": return "image/png";
      case "jpg":
      case "jpeg": return "image/jpeg";
      case "webp": return "image/webp";
      case "svg": return "image/svg+xml";
      case "gif": return "image/gif";
      case "csv": return "text/csv";
      case "txt": return "text/plain";
      case "zip": return "application/zip";
      case "rar": return "application/x-rar-compressed";
      case "7z": return "application/x-7z-compressed";
      case "mp4": return "video/mp4";
      case "mp3": return "audio/mpeg";
      default: return "application/octet-stream";
    }
  };

  const scopesToSync: { scope: DriveScope; bucket: string }[] = getAllDriveBuckets();

  let totalScanned = 0;
  let totalSyncedFiles = 0;
  let totalCreatedFolders = 0;

  const folderCache = new Map<string, { id: string; path: string; depth: number }>();

  for (const { scope, bucket } of scopesToSync) {
    console.log(`\n📦 Checking bucket: "${bucket}" (Scope: ${scope})...`);
    const bucketExists = await minioClient.bucketExists(bucket);
    if (!bucketExists) {
      console.log(`⚠️ Bucket "${bucket}" does not exist in MinIO. Skipping.`);
      continue;
    }

    const stream = minioClient.listObjectsV2(bucket, "", true);
    const minioObjects: { name: string; size: number; lastModified: Date }[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (obj) => {
        if (obj.name && !obj.name.endsWith("/") && !obj.name.includes(".DS_Store") && !obj.name.toLowerCase().endsWith("thumbs.db")) {
          minioObjects.push({
            name: obj.name,
            size: obj.size || 0,
            lastModified: obj.lastModified || new Date(),
          });
        }
      });
      stream.on("error", reject);
      stream.on("end", resolve);
    });

    console.log(`   Found ${minioObjects.length} raw object(s) in MinIO bucket "${bucket}".`);
    totalScanned += minioObjects.length;

    if (minioObjects.length === 0) continue;

    const existingItems = await prisma.driveItem.findMany({
      where: { scope, type: "FILE" },
      select: { storageKey: true },
    });

    const existingStorageKeys = new Set(existingItems.map((i) => i.storageKey).filter(Boolean));
    const missingObjects = minioObjects.filter((obj) => !existingStorageKeys.has(obj.name));

    console.log(`   ${missingObjects.length} object(s) need synchronization into database.`);

    if (missingObjects.length === 0) continue;

    async function getOrCreateFolder(
      segments: string[],
      folderScope: DriveScope,
      ownerId: string,
      createdAt: Date
    ): Promise<{ id: string | null; path: string; depth: number }> {
      if (segments.length === 0) return { id: null, path: "/", depth: 0 };

      let currentParentId: string | null = null;
      let currentPath = "/";
      let currentDepth = 0;

      for (let i = 0; i < segments.length; i++) {
        const segment: string = segments[i].trim();
        if (!segment) continue;

        const cacheKey: string = `${folderScope}:${currentParentId || "root"}:${segment.toLowerCase()}`;

        if (folderCache.has(cacheKey)) {
          const cached: { id: string; path: string; depth: number } = folderCache.get(cacheKey)!;
          currentParentId = cached.id;
          currentPath = cached.path;
          currentDepth = cached.depth;
        } else {
          let folder: any = await prisma.driveItem.findFirst({
            where: {
              scope: folderScope,
              type: "FOLDER",
              name: { equals: segment, mode: "insensitive" },
              parentId: currentParentId,
              isTrashed: false,
            },
          });

          if (!folder) {
            folder = await prisma.driveItem.create({
              data: {
                name: segment,
                type: "FOLDER",
                scope: folderScope,
                parentId: currentParentId,
                path: currentPath,
                depth: currentDepth,
                ownerId,
                createdBy: ownerId,
                createdAt,
                updatedAt: createdAt,
              },
            });

            const folderPath = `${currentPath}${folder.id}/`;
            folder = await prisma.driveItem.update({
              where: { id: folder.id },
              data: { path: folderPath },
            });

            totalCreatedFolders++;
            console.log(`   📁 Created folder: "${segment}" (${folder.id})`);
          }

          const resolvedPath = folder.path || `${currentPath}${folder.id}/`;
          const resolvedDepth = folder.depth || currentDepth + 1;

          folderCache.set(cacheKey, {
            id: folder.id,
            path: resolvedPath,
            depth: resolvedDepth,
          });

          currentParentId = folder.id;
          currentPath = resolvedPath;
          currentDepth = resolvedDepth;
        }
      }

      return { id: currentParentId, path: currentPath, depth: currentDepth };
    }

    for (const obj of missingObjects) {
      const parts = obj.name.split("/").filter(Boolean);
      const rawFileName = parts.pop() || obj.name;

      let displayName = rawFileName;
      const timestampMatch = rawFileName.match(/^\d{13}-(.+)$/);
      if (timestampMatch && timestampMatch[1]) {
        displayName = timestampMatch[1];
      }

      const folderInfo = await getOrCreateFolder(parts, scope, adminUser.id, obj.lastModified);
      const ext = displayName.split(".").pop()?.toLowerCase() || null;
      const mimeType = inferMimeType(displayName);

      const newDriveItem = await prisma.driveItem.create({
        data: {
          name: displayName,
          type: "FILE",
          scope,
          mimeType,
          extension: ext,
          size: obj.size,
          bucket,
          storageKey: obj.name,
          parentId: folderInfo.id,
          path: folderInfo.path,
          depth: folderInfo.depth + 1,
          ownerId: adminUser.id,
          createdBy: adminUser.id,
          createdAt: obj.lastModified,
          updatedAt: obj.lastModified,
        },
      });

      await prisma.driveActivity.create({
        data: {
          driveItemId: newDriveItem.id,
          userId: adminUser.id,
          action: "UPLOADED",
          details: `Synchronized file from MinIO storage (FTP): ${displayName}`,
          createdAt: obj.lastModified,
        },
      });

      totalSyncedFiles++;
      console.log(`   📄 Imported file: "${displayName}" (${(obj.size / 1024).toFixed(1)} KB)`);
    }
  }

  console.log("\n==================================================");
  console.log("✅ MINIO STORAGE SYNC FINISHED");
  console.log(`📊 Total Objects Scanned: ${totalScanned}`);
  console.log(`📁 Total Folders Created: ${totalCreatedFolders}`);
  console.log(`📄 Total Files Synced:    ${totalSyncedFiles}`);
  console.log("==================================================");
}

if (require.main === module) {
  runStorageSync()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Sync Error:", err);
      process.exit(1);
    });
}
