import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { getFtpBucket } from "@/lib/drive-storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params as required by recent Next.js versions
    const { id } = await params;

    // Find the file share record
    const fileShare = await prisma.fileShare.findUnique({
      where: { id },
    });

    if (!fileShare) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (fileShare.uploaderId !== session.user.id) {
      return NextResponse.json({ error: "Only the owner can generate a public link" }, { status: 403 });
    }

    const bucket = fileShare.bucket || getFtpBucket();
    const objectName = fileShare.storageKey;

    // MinIO (S3 SigV4) has a strict maximum expiration of 7 days (604800 seconds).
    // The MinIO client will throw an ExpiresParamError if we exceed this limit.
    const presignedUrl = await minioClient.presignedGetObject(
      bucket,
      objectName,
      7 * 24 * 60 * 60 // 7 days in seconds (max allowed)
    );

    return NextResponse.json({ url: presignedUrl });
  } catch (error: any) {
    console.error("[File Share Presigned Link Error]", error);
    return NextResponse.json(
      { error: "Failed to generate presigned link" },
      { status: 500 }
    );
  }
}
