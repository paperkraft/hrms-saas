import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getLibraryBucket } from "@/lib/drive-storage";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { objectName, filename, size, type, category: rawCategory, bucket } = body;

    if (!objectName || !filename) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const trimmedCategory = (rawCategory || "").split('/').map((s: string) => s.trim()).filter(Boolean).join('/');
    let category = trimmedCategory || "Uncategorized";

    // Re-use existing category casing
    const existingDoc = await prisma.libraryDocument.findFirst({
      where: {
        category: {
          equals: category,
          mode: 'insensitive'
        }
      }
    });

    if (existingDoc && existingDoc.category) {
      category = existingDoc.category;
    }

    const document = await prisma.libraryDocument.create({
      data: {
        name: filename,
        fileUrl: objectName,
        size: Number(size),
        type: type || "application/octet-stream",
        category: category,
        bucket: bucket || getLibraryBucket(),
        uploadedBy: session.user.id,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "UPLOADED_DOCUMENT",
        details: `Uploaded library document: ${filename}`,
      }
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error("[Library Confirm Upload Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
