"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";

import { getFtpBucket, ensureBucket } from "@/lib/drive-storage";

export async function syncFileShareStorage() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const ftpBucket = getFtpBucket();
    // 1. Ensure the bucket exists
    await ensureBucket(ftpBucket);

    // 2. Get all FileShares currently in the DB from this bucket
    const dbDocs = await prisma.fileShare.findMany({
      where: { bucket: ftpBucket },
      select: { storageKey: true }
    });
    const dbFiles = new Set(dbDocs.map(d => d.storageKey));

    // 3. Get all objects and prefixes (top-level folders) from MinIO FTP bucket
    const minioItems = new Map<string, any>();
    await new Promise<void>((resolve, reject) => {
      // recursive = false to only get root items and top-level prefixes
      const stream = minioClient.listObjects(ftpBucket, '', false);
      stream.on('data', function (obj) {
        if (obj.prefix) {
          // It's a folder, e.g. "Project-Alpha/"
          minioItems.set(obj.prefix, { isFolder: true, name: obj.prefix });
        } else if (obj.name) {
          // It's a file at the root
          minioItems.set(obj.name, { isFolder: false, name: obj.name, size: obj.size });
        }
      });
      stream.on('end', function () {
        resolve();
      });
      stream.on('error', function (err) {
        reject(err);
      });
    });

    // 4. Find missing records
    const missingInDb = Array.from(minioItems.values()).filter(item => !dbFiles.has(item.name));

    if (missingInDb.length === 0) {
      return { success: true, message: "Storage is already in sync", syncedCount: 0 };
    }

    const inferMimeType = (filename: string) => {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'pdf': return 'application/pdf';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'xls': return 'application/vnd.ms-excel';
        case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'ppt': return 'application/vnd.ms-powerpoint';
        case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'csv': return 'text/csv';
        case 'txt': return 'text/plain';
        case 'zip': return 'application/zip';
        default: return 'application/octet-stream';
      }
    };

    // 5. Create missing records
    for (const item of missingInDb) {
      if (item.isFolder) {
        const folderName = item.name.replace(/\/$/, ""); // Remove trailing slash
        await prisma.fileShare.create({
          data: {
            uploaderId: session.user.id,
            fileName: folderName,
            storageKey: item.name, // e.g. "Project-Alpha/"
            bucket: ftpBucket,
            isFolder: true,
            mimeType: "application/vnd.folder",
            size: 0,
            expiresAt: addDays(new Date(), 30),
          },
        });
      } else {
        const filename = item.name;
        await prisma.fileShare.create({
          data: {
            uploaderId: session.user.id,
            fileName: filename,
            storageKey: item.name,
            bucket: ftpBucket,
            isFolder: false,
            mimeType: inferMimeType(filename),
            size: item.size || 0,
            expiresAt: addDays(new Date(), 30),
          },
        });
      }
    }

    revalidatePath("/dashboard/file-share");
    return { success: true, message: `Successfully synced ${missingInDb.length} new items`, syncedCount: missingInDb.length };
  } catch (error: any) {
    console.error("[syncFileShareStorage]", error);
    return { error: error.message || "Failed to sync storage" };
  }
}