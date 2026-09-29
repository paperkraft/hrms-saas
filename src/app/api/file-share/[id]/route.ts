import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { getFtpBucket } from "@/lib/drive-storage";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shareRecord = await prisma.fileShare.findUnique({
      where: { id },
    });

    if (!shareRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Only uploader or admin can delete
    if (shareRecord.uploaderId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bucket = shareRecord.bucket || getFtpBucket();

    // Delete from MinIO
    try {
      await minioClient.removeObject(bucket, shareRecord.storageKey);
    } catch (minioError) {
      console.error("[File Share MinIO Delete Error]", minioError);
      // Proceed to delete DB record even if MinIO fails, to keep DB clean
    }

    // Delete from Prisma
    await prisma.fileShare.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[File Share DELETE Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
