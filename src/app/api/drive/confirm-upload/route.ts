import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DriveScope } from "@prisma/client";
import { checkCanUploadToPersonalDrive } from "@/lib/drive-quota";
import { getDriveBucket } from "@/lib/drive-storage";
import { isExternalUser } from "@/lib/permissions";
import { checkUserDriveItemAccess } from "@/actions/drive";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    const body = await req.json();
    const { name, objectName, size, mimeType, scope, parentId, relativePath } = body;

    if (!name || !objectName) {
      return NextResponse.json({ error: "Missing required file metadata" }, { status: 400 });
    }

    let driveScope = (scope || "ORGANIZATION_LIBRARY").toUpperCase() as DriveScope;

    let targetParentId: string | null = parentId && parentId !== "root" ? parentId : null;
    let parentPath = "/";
    let parentDepth = 0;

    if (targetParentId) {
      const parent = await prisma.driveItem.findUnique({
        where: { id: targetParentId },
      });
      if (parent) {
        driveScope = parent.scope;
        parentPath = parent.path;
        parentDepth = parent.depth;

        const access = await checkUserDriveItemAccess(
          session.user.id,
          parent,
          session.user.role,
          session.user.departmentId,
          isExternalUser(session.user)
        );
        if (!access.hasAccess || (access.accessLevel !== "EDITOR" && access.accessLevel !== "OWNER")) {
          return NextResponse.json(
            { error: "Permission denied. You have view-only access to this folder." },
            { status: 403 }
          );
        }
      }
    } else {
      const blockedScopes = ["TRASH", "SHARED_WITH_ME", "STARRED", "RECENT"];
      if (blockedScopes.includes(driveScope as string)) {
        return NextResponse.json(
          { error: "Uploading files is not allowed in this section" },
          { status: 400 }
        );
      }
      if (isExternalUser(session.user) && driveScope === "PROJECT") {
        return NextResponse.json(
          { error: "You do not have permission to upload files in this location" },
          { status: 403 }
        );
      }
    }

    // Quota validation for personal drive
    if (driveScope === "PERSONAL") {
      const quotaCheck = await checkCanUploadToPersonalDrive(session.user.id, Number(size) || 0);
      if (!quotaCheck.canUpload) {
        return NextResponse.json(
          { error: quotaCheck.reason || "Personal Drive quota exceeded" },
          { status: 400 }
        );
      }
    }

    const bucketName = getDriveBucket(driveScope);

    // Auto-create folder hierarchy if relativePath is provided
    if (relativePath) {
      const segments = relativePath.split("/").filter(Boolean);
      if (segments.length > 1) {
        // Exclude filename
        const folderSegments = segments.slice(0, -1);

        let currentParentId = targetParentId;
        let currentPath = parentPath;
        let currentDepth = parentDepth;

        for (const folderName of folderSegments) {
          const trimmed = folderName.trim();
          if (!trimmed) continue;

          let existingFolder = await prisma.driveItem.findFirst({
            where: {
              tenantId,
              name: { equals: trimmed, mode: "insensitive" },
              type: "FOLDER",
              scope: driveScope,
              parentId: currentParentId,
              isTrashed: false,
            },
          });

          if (!existingFolder) {
            // Create the folder
            const createdFolder = await prisma.driveItem.create({
              data: {
                tenantId,
                name: trimmed,
                type: "FOLDER",
                scope: driveScope,
                parentId: currentParentId,
                path: currentPath,
                depth: currentDepth,
                ownerId: session.user.id,
                createdBy: session.user.id,
              },
            });

            const newPath = `${currentPath}${createdFolder.id}/`;
            existingFolder = await prisma.driveItem.update({
              where: { id: createdFolder.id },
              data: { path: newPath },
            });
          }

          currentParentId = existingFolder.id;
          currentPath = existingFolder.path;
          currentDepth = existingFolder.depth + 1;
        }

        targetParentId = currentParentId;
        parentPath = currentPath;
        parentDepth = currentDepth;
      }
    }

    const ext = name.split(".").pop()?.toLowerCase() || null;

    const item = await prisma.driveItem.create({
      data: {
        tenantId,
        name,
        type: "FILE",
        scope: driveScope,
        mimeType: mimeType || "application/octet-stream",
        extension: ext,
        size: Number(size) || 0,
        bucket: bucketName,
        storageKey: objectName,
        parentId: targetParentId,
        path: parentPath,
        depth: parentDepth + 1,
        ownerId: session.user.id,
        createdBy: session.user.id,
      },
    });

    // Record initial version
    await prisma.driveVersion.create({
      data: {
        driveItemId: item.id,
        version: 1,
        storageKey: objectName,
        bucket: bucketName,
        size: Number(size) || 0,
        mimeType: mimeType || "application/octet-stream",
        uploadedById: session.user.id,
        changeNotes: "Initial file upload",
      },
    });

    // Log Activity
    await prisma.driveActivity.create({
      data: {
        driveItemId: item.id,
        userId: session.user.id,
        action: "UPLOAD_FILE",
        details: `Uploaded file "${name}" (${size} bytes) to ${driveScope}`,
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error("[Drive Confirm Upload Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
