import { NextRequest, NextResponse } from "next/server";
import { minioClient } from "@/lib/minio";
import { getMainStorageBucket } from "@/lib/drive-storage";

// In-memory cache for avatar buffers and metadata (max 200 avatars, TTL 5 minutes)
interface CachedAvatar {
  buffer: Buffer;
  contentType: string;
  etag: string;
  lastModified: string;
  size: number;
  cachedAt: number;
}

const avatarCache = new Map<string, CachedAvatar>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in memory
const MAX_CACHE_ENTRIES = 200;

function getMimeType(fileName: string, defaultType = "image/jpeg"): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'svg': return 'image/svg+xml';
    case 'gif': return 'image/gif';
    default: return defaultType;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams || !resolvedParams.path || resolvedParams.path.length === 0) {
      return new NextResponse("Missing path", { status: 400 });
    }

    // Strip query parameters from segments if present
    const cleanPath = resolvedParams.path.map(seg => seg.split('?')[0]);
    const objectName = cleanPath.join('/');
    const bucket = getMainStorageBucket();

    const ifNoneMatch = req.headers.get("if-none-match");
    const ifModifiedSince = req.headers.get("if-modified-since");

    // 1. Check in-memory buffer cache first (sub-millisecond return)
    const now = Date.now();
    const cached = avatarCache.get(objectName);

    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      if (
        (ifNoneMatch && ifNoneMatch === cached.etag) ||
        (ifModifiedSince && ifModifiedSince === cached.lastModified)
      ) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            "ETag": cached.etag,
            "Last-Modified": cached.lastModified,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800, immutable",
          },
        });
      }

      return new NextResponse(cached.buffer as any, {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "Content-Length": cached.size.toString(),
          "ETag": cached.etag,
          "Last-Modified": cached.lastModified,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800, immutable",
        },
      });
    }

    // 2. Query MinIO stat
    const stat = await minioClient.statObject(bucket, objectName);
    const etag = stat.etag ? `"${stat.etag.replace(/"/g, '')}"` : `W/"${stat.size}-${stat.lastModified.getTime()}"`;
    const lastModified = stat.lastModified.toUTCString();
    const contentType = stat.metaData?.['content-type'] || getMimeType(objectName);

    // Conditional HTTP request validation (304 Not Modified)
    if (
      (ifNoneMatch && ifNoneMatch === etag) ||
      (ifModifiedSince && ifModifiedSince === lastModified)
    ) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Last-Modified": lastModified,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800, immutable",
        },
      });
    }

    // 3. Fetch stream and buffer into memory
    const dataStream = await minioClient.getObject(bucket, objectName);
    const chunks: Buffer[] = [];

    for await (const chunk of dataStream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const fullBuffer = Buffer.concat(chunks);

    // Store in memory cache (LRU eviction if limit reached)
    if (avatarCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = avatarCache.keys().next().value;
      if (firstKey) avatarCache.delete(firstKey);
    }

    avatarCache.set(objectName, {
      buffer: fullBuffer,
      contentType,
      etag,
      lastModified,
      size: fullBuffer.length,
      cachedAt: now,
    });

    return new NextResponse(fullBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fullBuffer.length.toString(),
        "ETag": etag,
        "Last-Modified": lastModified,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800, immutable",
      },
    });
  } catch (error: any) {
    if (error?.code !== "NotFound") {
      console.error("[Avatar Proxy Error]", error);
    }
    return new NextResponse("Avatar not found", {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    });
  }
}
