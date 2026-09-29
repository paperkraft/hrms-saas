import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { minioClient } from "@/lib/minio";
import { getMainStorageBucket, ensureBucket } from "@/lib/drive-storage";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    const folder = searchParams.get("folder") || "general";
    
    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const timestamp = Date.now();
    const objectName = `${folder}/${session.user.id}/${timestamp}-${safeName}`;
    const bucket = getMainStorageBucket();
    await ensureBucket(bucket);

    // Generate a presigned URL valid for 1 hour (3600 seconds)
    const presignedUrl = await minioClient.presignedPutObject(
      bucket,
      objectName,
      3600
    );

    // Maintain backwards compatibility with the returned fileUrl format
    let urlPath = objectName;
    if (folder === "tasks") {
      urlPath = objectName.replace(/^tasks\//, "");
    }
    const fileUrl = `/api/task/${urlPath}`;

    return NextResponse.json({
      success: true,
      presignedUrl,
      fileUrl,
      fileName: filename,
      objectName
    });
  } catch (error: any) {
    console.error("[MinIO Task Presigned URL Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
