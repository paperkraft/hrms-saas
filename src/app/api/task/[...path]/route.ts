import { NextRequest, NextResponse } from "next/server";
import { minioClient } from "@/lib/minio";
import { Readable } from 'stream';
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
    
    let objectName = cleanPath.join('/');
    if (!objectName.startsWith('tasks/')) {
      objectName = 'tasks/' + objectName;
    }
    const bucket = getMainStorageBucket();
    
    const { searchParams } = new URL(req.url);
    const download = searchParams.get('download') === '1';
    
    // Fetch directly using the MinIO internal SDK connection to completely bypass DNS/Firewalls
    const stat = await minioClient.statObject(bucket, objectName);
    const dataStream = await minioClient.getObject(bucket, objectName);
    
    const headers = new Headers();
    headers.set("Content-Type", stat.metaData['content-type'] || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");
    
    const filename = objectName.split('/').pop() || 'attachment';
    headers.set("Content-Disposition", `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
    
    // Convert Node.js stream to Web ReadableStream
    const webStream = Readable.toWeb(dataStream as any);
    
    return new NextResponse(webStream as any, { status: 200, headers });
  } catch (error) {
    console.error("[Task Attachment Proxy Error]", error);
    return new NextResponse("Not found", { status: 404 });
  }
}
