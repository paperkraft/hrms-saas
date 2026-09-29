import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getLibraryBucket } from "@/lib/drive-storage";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { objectName, filename, size, type, bucket } = body;

    if (!objectName || !filename) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const document = await prisma.driveItem.create({
      data: {
        tenantId: session.user.tenantId,
        name: filename,
        storageKey: objectName,
        size: Number(size) || 0,
        mimeType: type || "application/octet-stream",
        bucket: bucket || getLibraryBucket(),
        ownerId: session.user.id,
        createdBy: session.user.id,
        type: "FILE",
        scope: "ORGANIZATION_LIBRARY",
      },
    });

    await prisma.activityLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: "UPLOADED_DOCUMENT",
        details: `Uploaded library document: ${filename}`,
      }
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error("[Library Confirm Upload Error]", error);
    return NextResponse.json({ error: error.message || "Failed to confirm upload" }, { status: 500 });
  }
}
