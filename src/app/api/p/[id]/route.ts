import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { PassThrough } from "stream";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find the file share record
    const fileShare = await prisma.fileShare.findUnique({
      where: { id },
    });

    if (!fileShare) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Check expiration based on our database
    if (fileShare.expiresAt && new Date(fileShare.expiresAt) < new Date()) {
      return new NextResponse("This link has expired", { status: 410 });
    }

    // Optionally increment view count
    await prisma.fileShare.update({
      where: { id },
      data: { currentViews: { increment: 1 } }
    });

    const { getFtpBucket } = await import("@/lib/drive-storage");
    const bucket = fileShare.bucket || getFtpBucket();
    let objectName = fileShare.storageKey;
    let downloadFileName = fileShare.fileName;

    // Handle folders
    if (fileShare.isFolder) {
      const action = req.nextUrl.searchParams.get("action");
      if (action === "zip") {
        const folderParam = req.nextUrl.searchParams.get("folder");
        let zipPrefix = fileShare.storageKey;
        if (!zipPrefix.endsWith('/')) zipPrefix += '/';

        let zipFileName = fileShare.fileName;

        if (folderParam) {
          zipPrefix += folderParam;
          if (!zipPrefix.endsWith('/')) zipPrefix += '/';

          const folderParts = folderParam.split('/').filter(Boolean);
          if (folderParts.length > 0) {
            zipFileName = folderParts[folderParts.length - 1];
          }
        }

        const { ZipArchive } = require("archiver");
        const archive = new ZipArchive({ zlib: { level: 5 } });
        const passThrough = new PassThrough();

        archive.pipe(passThrough);

        // Start streaming response immediately
        const { Readable } = require("stream");
        const response = new NextResponse(Readable.toWeb(passThrough) as any, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${zipFileName}.zip"`,
          },
        });

        // Gather list of files
        (async () => {
          try {
            const files: string[] = [];
            await new Promise<void>((resolve, reject) => {
              const listStream = minioClient.listObjects(bucket, zipPrefix, true);
              listStream.on("data", (obj) => {
                if (obj.name && !obj.name.endsWith("/")) files.push(obj.name);
              });
              listStream.on("end", resolve);
              listStream.on("error", reject);
            });

            // Append each file to the zip
            for (const file of files) {
              const fileStream = await minioClient.getObject(bucket, file);
              archive.append(fileStream as any, { name: file.substring(zipPrefix.length) });
            }

            archive.finalize();
          } catch (error) {
            console.error("[Zip Stream Error]", error);
            archive.abort();
          }
        })();

        return response;
      }

      const requestedFile = req.nextUrl.searchParams.get("file");

      if (!requestedFile) {
        // Redirect to the public folder page if no specific file is requested
        return NextResponse.redirect(new URL(`/share/${id}`, req.url));
      }

      // If a specific file is requested, construct its full object name
      objectName = fileShare.storageKey + requestedFile;
      downloadFileName = requestedFile.split('/').pop() || requestedFile;
    }

    // We use a dedicated public client to generate the presigned URL 
    // so the Signature v4 is calculated for the correct public Host header.
    const { Client } = require("minio");
    const publicMinioClient = new Client({
      endPoint: "storage.infraplan.co.in",
      useSSL: true,
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });

    const reqParams = {
      "response-content-disposition": `attachment; filename="${downloadFileName}"`,
      "response-content-type": fileShare.mimeType || "application/octet-stream",
    };

    // 7 days expiration for the download link
    const presignedUrl = await publicMinioClient.presignedGetObject(
      bucket,
      objectName,
      7 * 24 * 60 * 60,
      reqParams
    );

    // Redirect the user directly to the public MinIO server, bypassing Next.js load!
    return NextResponse.redirect(presignedUrl, 307);
  } catch (error: any) {
    console.error("[Tiny Link Redirect Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
