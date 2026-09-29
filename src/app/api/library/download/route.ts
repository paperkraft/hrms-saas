import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { Readable } from 'stream';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const download = searchParams.get("download") === "1";

    if (!id) {
      return new NextResponse("Missing document ID", { status: 400 });
    }

    const document = await prisma.driveItem.findUnique({
      where: { id },
    });

    if (!document || !document.storageKey || !document.bucket) {
      return new NextResponse("Document not found", { status: 404 });
    }

    // Fetch directly using the MinIO internal SDK connection
    const dataStream = await minioClient.getObject(
      document.bucket,
      document.storageKey
    );

    const headers = new Headers();
    headers.set("Content-Type", document.mimeType || "application/octet-stream");
    headers.set("Content-Disposition", `${download ? 'attachment' : 'inline'}; filename="${document.name}"`);

    // Convert Node.js stream to Web ReadableStream
    const webStream = Readable.toWeb(dataStream as any);

    return new NextResponse(webStream as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[Library Download Proxy Error]", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
