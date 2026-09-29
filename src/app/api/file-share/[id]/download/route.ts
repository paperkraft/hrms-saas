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

    // Check expiration
    if (shareRecord.expiresAt && shareRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: "File link has expired" }, { status: 410 });
    }

    // Check hard 30-day limit
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (shareRecord.createdAt < thirtyDaysAgo) {
      return NextResponse.json({ error: "File has been auto-purged (30 day limit)" }, { status: 410 });
    }

    // Check view limits
    if (shareRecord.maxViews && shareRecord.currentViews >= shareRecord.maxViews) {
      return NextResponse.json({ error: "Maximum views reached" }, { status: 410 });
    }

    // Increment view count
    await prisma.fileShare.update({
      where: { id },
      data: {
        currentViews: { increment: 1 },
      },
    });

    const bucket = shareRecord.bucket || getFtpBucket();

    // Get object stream from MinIO
    const dataStream = await minioClient.getObject(bucket, shareRecord.storageKey);

    // Convert MinIO stream to Web ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        dataStream.on("data", (chunk) => controller.enqueue(chunk));
        dataStream.on("end", () => controller.close());
        dataStream.on("error", (err) => controller.error(err));
      },
    });

    // Determine disposition (inline vs attachment)
    const { searchParams } = new URL(req.url);
    const download = searchParams.get("download");
    const disposition = download === "1" ? "attachment" : "inline";

    return new NextResponse(readableStream as any, {
      headers: {
        "Content-Type": shareRecord.mimeType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(shareRecord.fileName)}"`,
        "Content-Length": shareRecord.size.toString(),
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
      },
    });
  } catch (error: any) {
    console.error("[File Share Download Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
