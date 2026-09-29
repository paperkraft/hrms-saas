import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { minioClient } from "@/lib/minio";
import prisma from "@/lib/prisma";
import { DriveScope } from "@prisma/client";
import { checkCanUploadToPersonalDrive, getUserDriveQuota, formatQuotaBytes } from "@/lib/drive-quota";
import { getDriveBucket, ensureBucket } from "@/lib/drive-storage";
import { isExternalUser } from "@/lib/permissions";
import { checkUserDriveItemAccess } from "@/actions/drive";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    const contentType = searchParams.get("contentType") || "application/octet-stream";
    const size = parseInt(searchParams.get("size") || "0", 10);
    const scopeParam = searchParams.get("scope");
    const folderId = searchParams.get("folderId") || searchParams.get("parentId");

    let driveScope = (scopeParam || "ORGANIZATION_LIBRARY").toUpperCase() as DriveScope;

    if (folderId && folderId !== "root") {
      const parent = await prisma.driveItem.findUnique({
        where: { id: folderId },
      });
      if (parent) {
        driveScope = parent.scope;

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

    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    // Storage Quota & File Size Verification
    if (driveScope === "PERSONAL") {
      const quotaCheck = await checkCanUploadToPersonalDrive(session.user.id, size);
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          {
            error: quotaCheck.error,
            quotaInfo: quotaCheck.quotaInfo,
          },
          { status: 403 }
        );
      }
    } else if (size > 0) {
      // Check global single file size limit for non-personal scopes
      const quotaInfo = await getUserDriveQuota(session.user.id);
      if (size > quotaInfo.maxFileSizeBytes) {
        return NextResponse.json(
          {
            error: `File size (${formatQuotaBytes(size)}) exceeds maximum allowed upload limit of ${formatQuotaBytes(quotaInfo.maxFileSizeBytes)}.`,
          },
          { status: 400 }
        );
      }
    }

    const bucket = getDriveBucket(driveScope);
    await ensureBucket(bucket);

    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const timestamp = Date.now();
    const objectName =
      driveScope === "PERSONAL"
        ? `${session.user.id}/${timestamp}-${safeName}`
        : `${timestamp}-${safeName}`;

    const presignedUrl = await minioClient.presignedPutObject(
      bucket,
      objectName,
      60 * 60 // 1 hour expiry
    );

    return NextResponse.json({
      success: true,
      presignedUrl,
      objectName,
      bucket,
      filename,
      contentType,
    });
  } catch (error: any) {
    console.error("[Drive Presigned URL Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
