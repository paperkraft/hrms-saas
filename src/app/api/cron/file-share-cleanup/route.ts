import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { getFtpBucket } from "@/lib/drive-storage";

export async function GET(request: Request) {
  const serverSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const providedKey = request.headers.get("authorization")?.replace("Bearer ", "") || searchParams.get("key");

  if (!serverSecret || providedKey !== serverSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find all expired shares OR shares older than 30 days
    const expiredShares = await prisma.fileShare.findMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { createdAt: { lt: thirtyDaysAgo } }
        ]
      },
    });

    if (expiredShares.length === 0) {
      return NextResponse.json({ message: "No expired shares to clean up" });
    }

    const defaultBucket = getFtpBucket();
    let deletedCount = 0;

    for (const share of expiredShares) {
      try {
        const bucket = share.bucket || defaultBucket;
        // Delete from MinIO
        await minioClient.removeObject(bucket, share.storageKey);
        
        // Delete from Prisma
        await prisma.fileShare.delete({
          where: { id: share.id },
        });

        deletedCount++;
      } catch (err) {
        console.error(`[File Share Cleanup] Error deleting share ${share.id}:`, err);
      }
    }

    return NextResponse.json({
      message: `Successfully cleaned up ${deletedCount} expired file shares.`,
      deletedCount,
    });
  } catch (error: any) {
    console.error("[File Share Cleanup Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
