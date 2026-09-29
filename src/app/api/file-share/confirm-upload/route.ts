import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { addDays } from "date-fns";
import { getFtpBucket } from "@/lib/drive-storage";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      filename,
      objectName,
      size,
      type,
      expiresAtParam,
      sharedWithIds,
      sharedWithDeptIds,
      sendNotification,
      batchCount
    } = body;

    if (!filename || !objectName) {
      return NextResponse.json({ error: "Filename and objectName required" }, { status: 400 });
    }

    // Determine expiration date
    let expiresAt = null;
    if (expiresAtParam) {
      expiresAt = new Date(expiresAtParam);
    } else {
      // Default to 7 days
      expiresAt = addDays(new Date(), 7);
    }

    // Save metadata to Prisma
    const shareRecord = await prisma.fileShare.create({
      data: {
        tenantId: session.user.tenantId,
        uploaderId: session.user.id,
        fileName: filename,
        storageKey: objectName,
        bucket: getFtpBucket(),
        mimeType: type || "application/octet-stream",
        size: Number(size) || 0,
        expiresAt: expiresAt,
        sharedWith: {
          connect: (sharedWithIds || []).map((id: string) => ({ id })),
        },
        sharedWithDepts: {
          connect: (sharedWithDeptIds || []).map((id: string) => ({ id })),
        },
      },
    });

    let allUserIdsToNotify = new Set<string>(sharedWithIds || []);

    if (sharedWithDeptIds && sharedWithDeptIds.length > 0) {
      const deptUsers = await prisma.user.findMany({
        where: { departmentId: { in: sharedWithDeptIds } },
        select: { id: true },
      });
      deptUsers.forEach(u => allUserIdsToNotify.add(u.id));
    }

    const notifyIds = Array.from(allUserIdsToNotify);

    if (notifyIds.length > 0 && sendNotification) {
      const bCount = parseInt(batchCount || "1");
      const content = bCount > 1
        ? `${session.user.name || "A colleague"} shared ${bCount} new files with you.`
        : `${session.user.name || "A colleague"} shared a file with you: ${filename}`;

      const tenantId = session.user.tenantId as string;
      await prisma.notification.createMany({
        data: notifyIds.map((id) => ({
          tenantId,
          userId: id as string,
          title: bCount > 1 ? "New Files Shared" : "New File Shared",
          message: content,
          type: "INFO",
          link: "/dashboard/file-share",
        })),
      });
    }

    return NextResponse.json({
      success: true,
      shareId: shareRecord.id,
      fileName: filename,
    });
  } catch (error: any) {
    console.error("[File Share Confirm Error]", error);

    return NextResponse.json(
      { error: error.message || "Failed to confirm file share upload" },
      { status: 500 }
    );
  }
}
