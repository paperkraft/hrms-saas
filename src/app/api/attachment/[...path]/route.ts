import { NextRequest, NextResponse } from "next/server";
import { minioClient } from "@/lib/minio";
import { getMainStorageBucket } from "@/lib/drive-storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams || !resolvedParams.path) {
      return new NextResponse("Missing path", { status: 400 });
    }
    
    // Strip query parameters from the last element if present
    const cleanPath = [...resolvedParams.path];
    if (cleanPath.length > 0) {
      const lastSegment = cleanPath[cleanPath.length - 1];
      if (lastSegment.includes('?')) {
        cleanPath[cleanPath.length - 1] = lastSegment.split('?')[0];
      }
    }
    
    const objectName = cleanPath.join('/');
    const bucket = getMainStorageBucket();
    
    // Generate an internal presigned URL and fetch it
    const url = await minioClient.presignedGetObject(bucket, objectName, 60 * 5);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("Failed to fetch from MinIO: " + response.statusText);
    }
    
    const headers = new Headers();
    headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");
    
    return new NextResponse(response.body, { status: 200, headers });
  } catch (error) {
    console.error("[Attachment Proxy Error]", error);
    return new NextResponse("Not found", { status: 404 });
  }
}
