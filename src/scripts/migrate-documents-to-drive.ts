import "dotenv/config";
import prisma from "@/lib/prisma";
import { getLibraryBucket, getProjectDocumentsBucket } from "@/lib/drive-storage";

export async function migrateDocumentsToDrive() {
  console.log("🚀 Starting Zero-Data-Loss Migration to Google Drive Architecture...");

  // Cache folders: scope:path -> folderId
  const folderCache = new Map<string, { id: string; path: string; depth: number }>();

  async function getOrCreateFolder(
    segments: string[],
    scope: "ORGANIZATION_LIBRARY" | "PROJECT" | "PERSONAL" | "DEPARTMENT",
    ownerId: string,
    createdAt: Date
  ): Promise<{ id: string | null; path: string; depth: number }> {
    if (segments.length === 0) {
      return { id: null, path: "/", depth: 0 };
    }

    let currentParentId: string | null = null;
    let currentPath = "/";
    let currentDepth = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment: string = segments[i].trim();
      if (!segment) continue;

      const cacheKey: string = `${scope}:${currentParentId || "root"}:${segment.toLowerCase()}`;

      if (folderCache.has(cacheKey)) {
        const cached: { id: string; path: string; depth: number } = folderCache.get(cacheKey)!;
        currentParentId = cached.id;
        currentPath = cached.path;
        currentDepth = cached.depth;
      } else {
        // Look up existing in DB
        let folder: any = await prisma.driveItem.findFirst({
          where: {
            scope,
            type: "FOLDER",
            name: { equals: segment, mode: "insensitive" },
            parentId: currentParentId,
            isTrashed: false,
          },
        });

        if (!folder) {
          // Create new folder
          folder = await prisma.driveItem.create({
            data: {
              name: segment,
              type: "FOLDER",
              scope,
              parentId: currentParentId,
              path: currentPath, // Will update with id below
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

  // ── 1. Migrate Library Documents ──────────────────────────────────────────
  console.log("📚 Step 1: Migrating Library Documents...");
  const libraryDocs = await prisma.libraryDocument.findMany({
    orderBy: { createdAt: "asc" },
  });

  let libraryMigrated = 0;
  let librarySkipped = 0;

  for (const doc of libraryDocs) {
    const existing = await prisma.driveItem.findFirst({
      where: {
        legacyId: doc.id,
        legacySource: "LibraryDocument",
      },
    });

    if (existing) {
      librarySkipped++;
      continue;
    }

    // Parse category
    let segments: string[] = [];
    if (doc.category && doc.category.trim() !== "" && doc.category.toLowerCase() !== "uncategorized" && doc.category.toLowerCase() !== "root") {
      segments = doc.category.split("/").map((s) => s.trim()).filter(Boolean);
    }

    const folderInfo = await getOrCreateFolder(
      segments,
      "ORGANIZATION_LIBRARY",
      doc.uploadedBy,
      doc.createdAt
    );

    const ext = doc.name.split(".").pop()?.toLowerCase() || null;

    const driveItem = await prisma.driveItem.create({
      data: {
        name: doc.name,
        type: "FILE",
        scope: "ORGANIZATION_LIBRARY",
        mimeType: doc.type,
        extension: ext,
        size: doc.size,
        bucket: doc.bucket || getLibraryBucket(),
        storageKey: doc.fileUrl,
        parentId: folderInfo.id,
        path: folderInfo.path,
        depth: folderInfo.depth + 1,
        ownerId: doc.uploadedBy,
        createdBy: doc.uploadedBy,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        legacyId: doc.id,
        legacySource: "LibraryDocument",
      },
    });

    // Create initial activity log for the drive item
    await prisma.driveActivity.create({
      data: {
        driveItemId: driveItem.id,
        userId: doc.uploadedBy,
        action: "UPLOADED",
        details: `Uploaded ${doc.name} to Organization Library (migrated)`,
        createdAt: doc.createdAt,
      },
    });

    libraryMigrated++;
  }

  console.log(`✅ Library Migration: ${libraryMigrated} items migrated, ${librarySkipped} skipped (already migrated).`);

  // ── 2. Migrate Project Documents ──────────────────────────────────────────
  console.log("🚀 Step 2: Migrating Project Documents...");
  const projectDocs = await prisma.projectDocument.findMany({
    orderBy: { createdAt: "asc" },
  });

  let projectMigrated = 0;
  let projectSkipped = 0;

  for (const doc of projectDocs) {
    const existing = await prisma.driveItem.findFirst({
      where: {
        legacyId: doc.id,
        legacySource: "ProjectDocument",
      },
    });

    if (existing) {
      projectSkipped++;
      continue;
    }

    let segments: string[] = [];
    if (doc.category && doc.category.trim() !== "" && doc.category.toLowerCase() !== "uncategorized" && doc.category.toLowerCase() !== "root") {
      segments = doc.category.split("/").map((s) => s.trim()).filter(Boolean);
    }

    const folderInfo = await getOrCreateFolder(
      segments,
      "PROJECT",
      doc.uploadedBy,
      doc.createdAt
    );

    const ext = doc.name.split(".").pop()?.toLowerCase() || null;

    const driveItem = await prisma.driveItem.create({
      data: {
        name: doc.name,
        type: "FILE",
        scope: "PROJECT",
        mimeType: doc.type,
        extension: ext,
        size: doc.size,
        bucket: doc.bucket || getProjectDocumentsBucket(),
        storageKey: doc.fileUrl,
        parentId: folderInfo.id,
        path: folderInfo.path,
        depth: folderInfo.depth + 1,
        ownerId: doc.uploadedBy,
        createdBy: doc.uploadedBy,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        legacyId: doc.id,
        legacySource: "ProjectDocument",
      },
    });

    await prisma.driveActivity.create({
      data: {
        driveItemId: driveItem.id,
        userId: doc.uploadedBy,
        action: "UPLOADED",
        details: `Uploaded ${doc.name} to Project Documents (migrated)`,
        createdAt: doc.createdAt,
      },
    });

    projectMigrated++;
  }

  console.log(`✅ Project Documents Migration: ${projectMigrated} items migrated, ${projectSkipped} skipped (already migrated).`);

  // Final Summary Stats
  const totalFolders = await prisma.driveItem.count({ where: { type: "FOLDER" } });
  const totalFiles = await prisma.driveItem.count({ where: { type: "FILE" } });
  const totalSizeResult = await prisma.driveItem.aggregate({
    where: { type: "FILE" },
    _sum: { size: true },
  });

  console.log("==================================================");
  console.log("🎉 ZERO-DATA-LOSS MIGRATION COMPLETE!");
  console.log(`📁 Total Folders Created: ${totalFolders}`);
  console.log(`📄 Total Files Migrated: ${totalFiles}`);
  console.log(`💾 Total Data Managed: ${( (totalSizeResult._sum.size || 0) / (1024 * 1024) ).toFixed(2)} MB`);
  console.log("==================================================");

  return {
    libraryMigrated,
    librarySkipped,
    projectMigrated,
    projectSkipped,
    totalFolders,
    totalFiles,
    totalSizeBytes: totalSizeResult._sum.size || 0,
  };
}

// Auto-run if executed via ts-node/tsx/npm
if (require.main === module) {
  migrateDocumentsToDrive()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration error:", err);
      process.exit(1);
    });
}
