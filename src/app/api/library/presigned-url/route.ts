import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { minioClient } from "@/lib/minio";
import { getLibraryBucket, ensureBucket } from "@/lib/drive-storage";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    const contentType = searchParams.get("contentType") || "application/octet-stream";
    const category = searchParams.get("category") || "";
    
    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    const libraryBucket = getLibraryBucket();
    await ensureBucket(libraryBucket);

    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const timestamp = Date.now();
    let objectName = `${timestamp}-${safeName}`;
    if (category) {
      objectName = `${category}/${objectName}`;
    }

    // Generate a presigned URL valid for 1 hour (3600 seconds)
    const presignedUrl = await minioClient.presignedPutObject(
      libraryBucket,
      objectName,
      3600
    );

    return NextResponse.json({ 
      success: true, 
      presignedUrl, 
      objectName,
      bucket: libraryBucket
    });
  } catch (error: any) {
    console.error("[MinIO Presigned URL Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
