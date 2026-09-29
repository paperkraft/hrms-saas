import { minioClient } from "@/lib/minio";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FolderIcon, DownloadIcon } from "lucide-react";
import { FolderTreeViewer } from "@/components/features/file-share/folder-tree-viewer";
import { appConfig } from "@/lib/app-config";


interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicFolderSharePage({ params }: PageProps) {
  const { id } = await params;

  const fileShare = await prisma.fileShare.findUnique({
    where: { id },
  });

  if (!fileShare || !fileShare.isFolder) {
    notFound();
  }

  // Increment view count
  await prisma.fileShare.update({
    where: { id },
    data: { currentViews: { increment: 1 } },
  });

  const { getFtpBucket } = await import("@/lib/drive-storage");
  const bucket = fileShare.bucket || getFtpBucket();
  const prefix = fileShare.storageKey; // e.g., "Project-Alpha/"

  // Fetch objects in this folder directly from MinIO
  const files: any[] = [];
  await new Promise<void>((resolve, reject) => {
    // true for recursive, to get all files inside
    const stream = minioClient.listObjects(bucket, prefix, true);
    stream.on("data", (obj) => {
      // Ignore directory markers
      if (obj.name && !obj.name.endsWith("/")) {
        files.push(obj);
      }
    });
    stream.on("end", () => resolve());
    stream.on("error", (err) => reject(err));
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl w-full space-y-4 bg-white p-4 rounded-xl shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-50 rounded-lg shrink-0">
              <FolderIcon className="size-6 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate">{fileShare.fileName}</h1>
              <p className="text-xs text-gray-500">Shared Folder • {files.length} items</p>
            </div>
          </div>
          {files.length > 0 && (
            <a
              href={`/api/p/${id}?action=zip`}
              className="flex items-center justify-center w-full sm:w-auto shrink-0 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
            >
              <DownloadIcon className="w-4 h-4 mr-2 shrink-0" />
              <span>Download All (ZIP)</span>
            </a>
          )}
        </div>

        <div className="w-full mt-6">
          <FolderTreeViewer 
            shareId={id}
            files={files.map(f => ({
              relativeName: f.name.substring(prefix.length),
              size: f.size,
              downloadUrl: `/api/p/${id}?file=${encodeURIComponent(f.name.substring(prefix.length))}`
            }))} 
          />
        </div>

        <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          Powered by {appConfig.appName} Secure Sharing
        </div>
      </div>
    </div>
  );
}
