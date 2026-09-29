import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { minioClient } from "@/lib/minio";
import { getMainStorageBucket, ensureBucket } from "@/lib/drive-storage";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";

    const objectName = `users/${session.user.id}/avatar.${extension}`;
    const bucket = getMainStorageBucket();
    await ensureBucket(bucket);

    // Upload directly to MinIO from the server side!
    await minioClient.putObject(
      bucket,
      objectName,
      buffer,
      buffer.length,
      { "Content-Type": file.type }
    );

    const fileUrl = `/api/avatar/${objectName}`;

    return NextResponse.json({
      fileUrl,
    });
  } catch (error: any) {
    console.error("[MinIO Upload Error]", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to upload avatar to storage",
      },
      { status: 500 }
    );
  }
}