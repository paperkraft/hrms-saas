"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { revalidatePath } from "next/cache";
import { DriveScope, DriveItemType, DriveAccessLevel } from "@prisma/client";
import { getUserDriveQuota, checkCanUploadToPersonalDrive } from "@/lib/drive-quota";
import { isExternalUser } from "@/lib/permissions";
import { getDriveBucket, getLibraryBucket, getProjectDocumentsBucket, getPersonalDriveBucket, ensureBucket } from "@/lib/drive-storage";

export type DriveItemWithDetails = {
  id: string;
  name: string;
  type: DriveItemType;
  scope: DriveScope;
  mimeType: string | null;
  extension: string | null;
  size: number;
  bucket: string | null;
  storageKey: string | null;
  parentId: string | null;
  path: string;
  depth: number;
  color: string | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: Date | null;
  trashedByName?: string | null;
  description: string | null;
  tags: string[];
  version: number;
  itemCount?: number; // For folders
  parentName?: string | null;
  userAccessLevel?: "VIEWER" | "EDITOR" | "OWNER";
};

export type BreadcrumbItem = {
  id: string | null; // null for Root
  name: string;
  scope: DriveScope;
};

// ── Permission & Inheritance Helper ──────────────────────────────────────────
export async function checkUserDriveItemAccess(
  userId: string,
  item: { id: string; ownerId?: string | null; scope: DriveScope; path?: string | null; parentId?: string | null },
  userRole?: string,
  departmentId?: string | null,
  isExternal?: boolean
): Promise<{ hasAccess: boolean; accessLevel: "VIEWER" | "EDITOR" | "OWNER"; isOwner: boolean }> {
  const isAdmin = userRole === "ADMIN" || userRole === "SYSTEM_ADMIN";
  if (isAdmin || (item.ownerId && item.ownerId === userId)) {
    return { hasAccess: true, accessLevel: "OWNER", isOwner: true };
  }

  // Extract all ancestor folder IDs and current item ID from path
  // Path format: "/<id1>/<id2>/<id3>/"
  const pathIds: string[] = item.path
    ? item.path.split("/").filter(Boolean)
    : [];
  if (item.id && !pathIds.includes(item.id)) {
    pathIds.push(item.id);
  }

  const permissions = pathIds.length > 0
    ? await prisma.driveItemPermission.findMany({
        where: {
          driveItemId: { in: pathIds },
          OR: [
            { userId },
            ...(departmentId ? [{ departmentId }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const now = new Date();
  const validPermissions = permissions.filter((p) => !p.expiresAt || p.expiresAt > now);

  if (validPermissions.length > 0) {
    // If any permission in the chain grants EDITOR or ADMIN, grant EDITOR, otherwise VIEWER
    const hasEditor = validPermissions.some((p) => p.accessLevel === "EDITOR" || (p.accessLevel as string) === "ADMIN");
    return {
      hasAccess: true,
      accessLevel: hasEditor ? "EDITOR" : "VIEWER",
      isOwner: false,
    };
  }

  // If no explicit permission override is set:
  const isExt = isExternal !== undefined ? isExternal : isExternalUser({ role: userRole });

  if (!isExt) {
    // Internal members:
    // Personal drive is private to the owner
    if (item.scope === "PERSONAL") {
      return { hasAccess: false, accessLevel: "VIEWER", isOwner: false };
    }
    // Organization Library, Project Documents, Department: Internal members have full EDITOR access by default
    return {
      hasAccess: true,
      accessLevel: "EDITOR",
      isOwner: false,
    };
  }

  // External users:
  // External users have no access without explicit permission
  return { hasAccess: false, accessLevel: "VIEWER", isOwner: false };
}

// ── 1. Fetch Drive Contents ──────────────────────────────────────────────────
export async function getDriveContents(params: {
  scope?: string;
  folderId?: string | null;
  searchQuery?: string;
  typeFilter?: string;
  sortBy?: "name" | "updatedAt" | "size" | "type";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const userId = session.user.id;
    const userRole = session.user.role;
    const isTeamLeader = session.user.isTeamLeader;

    const requestedScope = (params.scope || "ORGANIZATION_LIBRARY").toUpperCase();
    const folderId = params.folderId && params.folderId !== "root" ? params.folderId : null;
    const searchQuery = params.searchQuery?.trim() || "";
    const typeFilter = params.typeFilter || "all";
    const sortBy = params.sortBy || (requestedScope === "RECENT" ? "updatedAt" : "name");
    const sortOrder = params.sortOrder || (requestedScope === "RECENT" ? "desc" : "asc");

    // Guard: Restricted access to Project Documents root, Trash, or Recent without explicit permissions
    const isExternal = isExternalUser(session.user);
    if (isExternal && requestedScope === "PROJECT" && !folderId) {
      return { success: false, error: "Access Denied: You do not have permission to view this section." };
    }
    if (isExternal && requestedScope === "TRASH") {
      return { success: false, error: "Access Denied: You do not have permission to access Trash." };
    }
    if (isExternal && requestedScope === "RECENT") {
      return { success: false, error: "Access Denied: You do not have permission to access Recent." };
    }

    // Starred items by current user
    const starredRecords = await prisma.driveStarredItem.findMany({
      where: { userId },
      select: { driveItemId: true },
    });
    const starredSet = new Set(starredRecords.map((s) => s.driveItemId));

    const andConditions: any[] = [];

    // 1. Scope & Folder Navigation Condition
    if (folderId) {
      // User has opened / navigated inside a specific folder
      const isFiltering = !!searchQuery || (typeFilter !== "all" && typeFilter !== "folder");
      const currentFolderRec = await prisma.driveItem.findUnique({
        where: { id: folderId },
        select: { id: true, ownerId: true, path: true, isTrashed: true, scope: true, parentId: true },
      });

      if (!currentFolderRec) {
        return { success: false, error: "Folder not found." };
      }

      if (isExternal && (currentFolderRec.scope === "PROJECT" || currentFolderRec.scope === "PERSONAL")) {
        const access = await checkUserDriveItemAccess(userId, currentFolderRec, userRole, session.user.departmentId);
        if (!access.hasAccess) {
          return { success: false, error: "Access Denied: You do not have permission to view this folder." };
        }
      }

      const folderIsTrashed = currentFolderRec.isTrashed ?? (requestedScope === "TRASH");
      andConditions.push({ isTrashed: folderIsTrashed });

      if (!isFiltering) {
        andConditions.push({ parentId: folderId });
      } else if (currentFolderRec.path) {
        andConditions.push({ path: { startsWith: currentFolderRec.path }, id: { not: folderId } });
      }
    } else if (requestedScope === "TRASH") {
      andConditions.push({ isTrashed: true });
      if (userRole !== "ADMIN" && userRole !== "SYSTEM_ADMIN" && !isTeamLeader) {
        andConditions.push({ ownerId: userId });
      }

      const isFiltering = !!searchQuery || (typeFilter !== "all" && typeFilter !== "folder");
      if (!isFiltering) {
        // Only show top-level trashed items (items whose parent is NOT trashed, or parentId is null)
        andConditions.push({
          OR: [
            { parentId: null },
            { parent: { isTrashed: false } },
          ],
        });
      }
    } else if (requestedScope === "STARRED") {
      andConditions.push({
        isTrashed: false,
        id: { in: Array.from(starredSet) },
      });
    } else if (requestedScope === "RECENT") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      andConditions.push({
        isTrashed: false,
        type: "FILE",
        updatedAt: { gte: thirtyDaysAgo },
      });
    } else if (requestedScope === "SHARED_WITH_ME") {
      andConditions.push({
        isTrashed: false,
        ownerId: { not: userId },
        permissions: {
          some: {
            OR: [
              { userId },
              ...(session.user.departmentId ? [{ departmentId: session.user.departmentId }] : []),
            ],
          },
        },
      });
    } else if (requestedScope === "PERSONAL") {
      // "My Drive" is private to the current user
      andConditions.push({
        isTrashed: false,
        scope: "PERSONAL",
        ownerId: userId,
      });

      const isFiltering = !!searchQuery || (typeFilter !== "all" && typeFilter !== "folder");
      if (!isFiltering) {
        andConditions.push({ parentId: null });
      }
    } else {
      andConditions.push({
        isTrashed: false,
        scope: requestedScope as DriveScope,
      });

      const isFiltering = !!searchQuery || (typeFilter !== "all" && typeFilter !== "folder");
      if (!isFiltering) {
        andConditions.push({ parentId: null });
      }
    }

    // 2. Search Query (matches filename or extension)
    if (searchQuery) {
      andConditions.push({
        OR: [
          { name: { contains: searchQuery, mode: "insensitive" } },
          { extension: { contains: searchQuery, mode: "insensitive" } },
        ],
      });
    }

    // 3. File Type Filter
    if (typeFilter !== "all") {
      if (typeFilter === "folder") {
        andConditions.push({ type: "FOLDER" });
      } else {
        andConditions.push({ type: "FILE" });
        if (typeFilter === "pdf") {
          andConditions.push({
            OR: [
              { mimeType: { contains: "pdf", mode: "insensitive" } },
              { extension: { equals: "pdf", mode: "insensitive" } },
            ],
          });
        } else if (typeFilter === "spreadsheet") {
          andConditions.push({
            OR: [
              { mimeType: { contains: "excel", mode: "insensitive" } },
              { mimeType: { contains: "spreadsheet", mode: "insensitive" } },
              { mimeType: { contains: "sheet", mode: "insensitive" } },
              { extension: { in: ["xls", "xlsx", "csv", "ods"], mode: "insensitive" } },
            ],
          });
        } else if (typeFilter === "doc") {
          andConditions.push({
            OR: [
              { mimeType: { contains: "word", mode: "insensitive" } },
              { mimeType: { contains: "document", mode: "insensitive" } },
              { mimeType: { contains: "text", mode: "insensitive" } },
              { extension: { in: ["doc", "docx", "txt", "rtf", "odt"], mode: "insensitive" } },
            ],
          });
        } else if (typeFilter === "image") {
          andConditions.push({
            OR: [
              { mimeType: { startsWith: "image/" } },
              { extension: { in: ["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp", "ico"], mode: "insensitive" } },
            ],
          });
        } else if (typeFilter === "presentation") {
          andConditions.push({
            OR: [
              { mimeType: { contains: "presentation", mode: "insensitive" } },
              { mimeType: { contains: "powerpoint", mode: "insensitive" } },
              { extension: { in: ["ppt", "pptx", "odp"], mode: "insensitive" } },
            ],
          });
        } else if (typeFilter === "archive") {
          andConditions.push({
            OR: [
              { mimeType: { contains: "zip", mode: "insensitive" } },
              { mimeType: { contains: "tar", mode: "insensitive" } },
              { mimeType: { contains: "compressed", mode: "insensitive" } },
              { extension: { in: ["zip", "rar", "7z", "tar", "gz", "bz2"], mode: "insensitive" } },
            ],
          });
        } else if (typeFilter === "media") {
          andConditions.push({
            OR: [
              { mimeType: { startsWith: "video/" } },
              { mimeType: { startsWith: "audio/" } },
              { extension: { in: ["mp4", "webm", "mkv", "mov", "avi", "mp3", "wav", "aac", "ogg", "flac"], mode: "insensitive" } },
            ],
          });
        }
      }
    }

    const whereClause: any = andConditions.length > 0 ? { AND: andConditions } : {};

    // Order By
    let orderBy: any = {};
    if (sortBy === "name") {
      orderBy = { name: sortOrder };
    } else if (sortBy === "updatedAt") {
      orderBy = { updatedAt: sortOrder };
    } else if (sortBy === "size") {
      orderBy = { size: sortOrder };
    } else if (sortBy === "type") {
      orderBy = { mimeType: sortOrder };
    }

    // Pagination & Count
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize || 60));
    const skip = (page - 1) * pageSize;

    const [totalCount, items] = await Promise.all([
      prisma.driveItem.count({ where: whereClause }),
      prisma.driveItem.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: [
          { type: "asc" }, // Folders first
          orderBy,
        ],
        select: {
          id: true,
          name: true,
          type: true,
          scope: true,
          mimeType: true,
          extension: true,
          size: true,
          bucket: true,
          storageKey: true,
          parentId: true,
          path: true,
          depth: true,
          color: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          isStarred: true,
          isTrashed: true,
          trashedAt: true,
          description: true,
          tags: true,
          version: true,
          parent: { select: { id: true, name: true } },
          owner: { select: { name: true, email: true } },
          trashedBy: { select: { name: true } },
          _count: { select: { children: { where: { isTrashed: requestedScope === "TRASH" } } } },
        },
      }),
    ]);

    // Format items
    const formattedItems: DriveItemWithDetails[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      scope: item.scope,
      mimeType: item.mimeType,
      extension: item.extension,
      size: item.size,
      bucket: item.bucket,
      storageKey: item.storageKey,
      parentId: item.parentId,
      parentName:
        item.parent?.name ||
        (item.parentId
          ? "Subfolder"
          : item.scope === "ORGANIZATION_LIBRARY"
            ? "Company Library"
            : item.scope === "PROJECT"
              ? "Project Documents"
              : item.scope === "PERSONAL"
                ? "My Drive"
                : "Root"),
      path: item.path,
      depth: item.depth,
      color: item.color,
      ownerId: item.ownerId,
      ownerName: item.owner?.name || "Unknown",
      ownerEmail: item.owner?.email || "",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isStarred: starredSet.has(item.id),
      isTrashed: item.isTrashed,
      trashedAt: item.trashedAt,
      trashedByName: item.trashedBy?.name,
      description: item.description,
      tags: item.tags,
      version: item.version,
      itemCount: item._count?.children ?? 0,
    }));

    const folders = formattedItems.filter((i) => i.type === "FOLDER");
    const files = formattedItems.filter((i) => i.type === "FILE");
    const hasMore = skip + items.length < totalCount;

    // Build Breadcrumb trail if in a folder
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentFolderInfo: DriveItemWithDetails | null = null;

    if (folderId) {
      const currentFolder = await prisma.driveItem.findUnique({
        where: { id: folderId },
        include: {
          owner: { select: { name: true, email: true } },
          _count: { select: { children: { where: { isTrashed: requestedScope === "TRASH" } } } },
        },
      });

      if (currentFolder) {
        const folderAccess = await checkUserDriveItemAccess(userId, currentFolder, userRole, session.user.departmentId);

        currentFolderInfo = {
          id: currentFolder.id,
          name: currentFolder.name,
          type: currentFolder.type,
          scope: currentFolder.scope,
          mimeType: currentFolder.mimeType,
          extension: currentFolder.extension,
          size: currentFolder.size,
          bucket: currentFolder.bucket,
          storageKey: currentFolder.storageKey,
          parentId: currentFolder.parentId,
          path: currentFolder.path,
          depth: currentFolder.depth,
          color: currentFolder.color,
          ownerId: currentFolder.ownerId,
          ownerName: currentFolder.owner?.name || "Unknown",
          ownerEmail: currentFolder.owner?.email || "",
          createdAt: currentFolder.createdAt,
          updatedAt: currentFolder.updatedAt,
          isStarred: starredSet.has(currentFolder.id),
          isTrashed: currentFolder.isTrashed,
          trashedAt: currentFolder.trashedAt,
          description: currentFolder.description,
          tags: currentFolder.tags,
          version: currentFolder.version,
          itemCount: currentFolder._count.children,
          userAccessLevel: folderAccess.accessLevel,
        };

        // Trace ancestors
        let curr: any = currentFolder;
        const trail: BreadcrumbItem[] = [];
        while (curr) {
          trail.unshift({
            id: curr.id,
            name: curr.name,
            scope: curr.scope,
          });

          if (curr.parentId) {
            // For external user in a shared project folder, don't trace above the top-level shared folder
            if (isExternal && (curr.scope === "PROJECT" || requestedScope === "SHARED_WITH_ME")) {
              const hasExplicitPerm = await prisma.driveItemPermission.findFirst({
                where: {
                  driveItemId: curr.id,
                  OR: [
                    { userId },
                    ...(session.user.departmentId ? [{ departmentId: session.user.departmentId }] : []),
                  ],
                },
              });
              if (hasExplicitPerm) {
                break;
              }
            }

            curr = await prisma.driveItem.findUnique({
              where: { id: curr.parentId },
            });
          } else {
            curr = null;
          }
        }
        breadcrumbs.push(...trail);
      }
    }

    return {
      success: true,
      folders,
      files,
      breadcrumbs,
      currentFolder: currentFolderInfo,
      totalCount,
      page,
      pageSize,
      hasMore,
    };
  } catch (error: any) {
    console.error("[getDriveContents]", error);
    return { error: error.message || "Failed to fetch drive contents" };
  }
}

// ── 2. Create Folder ─────────────────────────────────────────────────────────
export async function createDriveFolder(data: {
  name: string;
  scope: DriveScope;
  parentId?: string | null;
  color?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const folderName = data.name.trim();
    if (!folderName) throw new Error("Folder name cannot be empty");

    let targetScope = data.scope as DriveScope;
    let parentPath = "/";
    let parentDepth = 0;

    if (data.parentId) {
      const parent = await prisma.driveItem.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new Error("Parent folder not found");
      targetScope = parent.scope;
      parentPath = parent.path;
      parentDepth = parent.depth;

      const access = await checkUserDriveItemAccess(
        session.user.id,
        parent,
        session.user.role,
        session.user.departmentId,
        isExternalUser(session.user)
      );
      if (!access.hasAccess || (access.accessLevel !== "EDITOR" && access.accessLevel !== "OWNER")) {
        throw new Error("Permission denied. You have view-only access to this folder.");
      }
    } else {
      const blockedScopes = ["TRASH", "SHARED_WITH_ME", "STARRED", "RECENT"];
      if (blockedScopes.includes(data.scope as string)) {
        throw new Error("Creating folders is not allowed in this section");
      }
      if (isExternalUser(session.user) && data.scope === "PROJECT") {
        throw new Error("You do not have permission to create folders in this location");
      }
    }

    // Check duplicate in same folder
    const existing = await prisma.driveItem.findFirst({
      where: {
        parentId: data.parentId || null,
        scope: targetScope,
        type: "FOLDER",
        name: { equals: folderName, mode: "insensitive" },
        isTrashed: false,
      },
    });

    if (existing) {
      throw new Error(`A folder named "${folderName}" already exists here`);
    }

    const folder = await prisma.driveItem.create({
      data: {
        name: folderName,
        type: "FOLDER",
        scope: targetScope,
        parentId: data.parentId || null,
        path: parentPath,
        depth: parentDepth + 1,
        color: data.color || null,
        ownerId: session.user.id,
        createdBy: session.user.id,
      },
    });

    // Update path with folder ID
    const updatedFolder = await prisma.driveItem.update({
      where: { id: folder.id },
      data: { path: `${parentPath}${folder.id}/` },
    });

    // Audit log
    await prisma.driveActivity.create({
      data: {
        driveItemId: folder.id,
        userId: session.user.id,
        action: "CREATED_FOLDER",
        details: `Created folder "${folderName}"`,
      },
    });

    revalidatePath("/dashboard/documents");
    return { success: true, folder: updatedFolder };
  } catch (error: any) {
    console.error("[createDriveFolder]", error);
    return { error: error.message || "Failed to create folder" };
  }
}

// ── 3. Rename File or Folder ─────────────────────────────────────────────────
export async function renameDriveItem(id: string, newName: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const trimmedName = newName.trim();
    if (!trimmedName) throw new Error("Name cannot be empty");

    const item = await prisma.driveItem.findUnique({
      where: { id },
    });
    if (!item) throw new Error("Item not found");

    const userRole = session.user.role;
    const isAdmin = userRole === "ADMIN" || userRole === "SYSTEM_ADMIN";
    const isOwner = item.ownerId === session.user.id;
    const isExternal = isExternalUser(session.user);

    if (isExternal) {
      if (!isOwner) {
        throw new Error("Access Denied: You can only rename items that you own");
      }
    } else if (!isOwner && !isAdmin) {
      const access = await checkUserDriveItemAccess(
        session.user.id,
        item,
        session.user.role,
        session.user.departmentId,
        false
      );
      if (!access.hasAccess || (access.accessLevel !== "EDITOR" && access.accessLevel !== "OWNER")) {
        throw new Error("Permission denied. You have view-only access to this item.");
      }
    }

    const oldName = item.name;

    const updated = await prisma.driveItem.update({
      where: { id },
      data: {
        name: trimmedName,
        lastModifiedById: session.user.id,
        updatedAt: new Date(),
      },
    });

    await prisma.driveActivity.create({
      data: {
        driveItemId: id,
        userId: session.user.id,
        action: "RENAMED",
        details: `Renamed from "${oldName}" to "${trimmedName}"`,
      },
    });

    revalidatePath("/dashboard/documents");
    return { success: true, item: updated };
  } catch (error: any) {
    console.error("[renameDriveItem]", error);
    return { error: error.message || "Failed to rename item" };
  }
}

// ── 4. Move Files / Folders ──────────────────────────────────────────────────
export async function moveDriveItems(
  itemIds: string[],
  targetFolderId: string | null,
  targetScope?: DriveScope
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (!itemIds || itemIds.length === 0) throw new Error("No items selected to move");

    const isExternal = isExternalUser(session.user);
    const userRole = session.user.role;
    const isAdmin = userRole === "ADMIN" || userRole === "SYSTEM_ADMIN";

    if (isExternal) {
      // 1. External users CANNOT move to global root (targetFolderId cannot be null)
      if (!targetFolderId) {
        throw new Error("Access Denied: You can only move items into shared folders, not the global root");
      }

      // 2. Check destination folder access (must have EDITOR or OWNER access)
      const targetFolder = await prisma.driveItem.findUnique({
        where: { id: targetFolderId },
      });
      if (!targetFolder || targetFolder.type !== "FOLDER" || targetFolder.isTrashed) {
        throw new Error("Destination folder not found or is invalid");
      }

      const targetAccess = await checkUserDriveItemAccess(
        session.user.id,
        targetFolder,
        session.user.role,
        session.user.departmentId,
        true
      );
      if (!targetAccess.hasAccess || (targetAccess.accessLevel !== "EDITOR" && targetAccess.accessLevel !== "OWNER")) {
        throw new Error("Access Denied: You do not have edit access to the destination folder");
      }

      // 3. Check each item to move: must have edit access or be owner
      for (const id of itemIds) {
        const it = await prisma.driveItem.findUnique({ where: { id } });
        if (!it) continue;
        const isOwner = it.ownerId === session.user.id;
        if (!isOwner) {
          const itemAccess = await checkUserDriveItemAccess(
            session.user.id,
            it,
            session.user.role,
            session.user.departmentId,
            true
          );
          if (!itemAccess.hasAccess || (itemAccess.accessLevel !== "EDITOR" && itemAccess.accessLevel !== "OWNER")) {
            throw new Error(`Access Denied: You do not have permission to move "${it.name}"`);
          }
        }
      }
    } else {
      for (const id of itemIds) {
        const it = await prisma.driveItem.findUnique({ where: { id } });
        if (!it) continue;
        if (it.ownerId !== session.user.id && !isAdmin) {
          const perm = await prisma.driveItemPermission.findFirst({
            where: {
              driveItemId: id,
              OR: [
                { userId: session.user.id },
                ...(session.user.departmentId ? [{ departmentId: session.user.departmentId }] : []),
              ],
            },
          });
          if (perm && perm.accessLevel === "VIEWER") {
            throw new Error(`Permission denied. You have view-only access to "${it.name}"`);
          }
        }
      }
    }

    let targetPath = "/";
    let targetDepth = 0;
    let finalScope = targetScope;

    if (targetFolderId) {
      const targetFolder = await prisma.driveItem.findUnique({
        where: { id: targetFolderId },
      });
      if (!targetFolder || targetFolder.type !== "FOLDER") {
        throw new Error("Target folder not found");
      }
      targetPath = targetFolder.path;
      targetDepth = targetFolder.depth;
      finalScope = targetFolder.scope;

      // Prevent moving folder into itself or its own subfolder
      for (const id of itemIds) {
        if (id === targetFolderId || targetPath.includes(`/${id}/`)) {
          throw new Error("Cannot move a folder into itself or a subfolder");
        }
      }
    }

    for (const id of itemIds) {
      const item = await prisma.driveItem.findUnique({ where: { id } });
      if (!item) continue;

      const newPath = `${targetPath}${item.id}${item.type === "FOLDER" ? "/" : ""}`;

      await prisma.driveItem.update({
        where: { id },
        data: {
          parentId: targetFolderId,
          path: newPath,
          depth: targetDepth + 1,
          ...(finalScope ? { scope: finalScope } : {}),
          lastModifiedById: session.user.id,
          updatedAt: new Date(),
        },
      });

      // If moving a folder, update all recursive descendant paths & scope
      if (item.type === "FOLDER") {
        const oldPrefix = item.path;
        const descendants = await prisma.driveItem.findMany({
          where: {
            path: { startsWith: oldPrefix },
            id: { not: item.id },
          },
        });

        for (const desc of descendants) {
          const relativePath = desc.path.substring(oldPrefix.length);
          const updatedDescPath = `${newPath}${relativePath}`;
          await prisma.driveItem.update({
            where: { id: desc.id },
            data: {
              path: updatedDescPath,
              ...(finalScope ? { scope: finalScope } : {}),
            },
          });
        }
      }

      await prisma.driveActivity.create({
        data: {
          driveItemId: id,
          userId: session.user.id,
          action: "MOVED",
          details: `Moved to ${targetFolderId ? "folder" : "root"}`,
        },
      });
    }

    revalidatePath("/dashboard/documents");
    return { success: true, count: itemIds.length };
  } catch (error: any) {
    console.error("[moveDriveItems]", error);
    return { error: error.message || "Failed to move items" };
  }
}

// ── 5. Star / Favorite Toggle ────────────────────────────────────────────────
export async function toggleStarDriveItem(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const userId = session.user.id;

    const existing = await prisma.driveStarredItem.findUnique({
      where: {
        userId_driveItemId: {
          userId,
          driveItemId: id,
        },
      },
    });

    let isStarredNow = false;

    if (existing) {
      await prisma.driveStarredItem.deleteMany({
        where: { id: existing.id },
      });
      isStarredNow = false;
    } else {
      await prisma.driveStarredItem.create({
        data: {
          userId,
          driveItemId: id,
        },
      });
      isStarredNow = true;
    }

    // Keep denormalized isStarred updated for quick filter
    await prisma.driveItem.update({
      where: { id },
      data: { isStarred: isStarredNow },
    });

    revalidatePath("/dashboard/documents");
    return { success: true, isStarred: isStarredNow };
  } catch (error: any) {
    console.error("[toggleStarDriveItem]", error);
    return { error: error.message || "Failed to star item" };
  }
}

// ── 6. Trash (Soft Delete) ───────────────────────────────────────────────────
export async function trashDriveItems(itemIds: string[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const isExternal = isExternalUser(session.user);
    const userRole = session.user.role;
    const isAdmin = userRole === "ADMIN" || userRole === "SYSTEM_ADMIN";
    const currentUserId = session.user.id;
    const departmentId = session.user.departmentId;

    let trashedCount = 0;
    let unsharedCount = 0;
    const now = new Date();

    for (const id of itemIds) {
      const item = await prisma.driveItem.findUnique({ where: { id } });
      if (!item) continue;

      const isOwner = item.ownerId === currentUserId;

      if (isExternal && !isOwner) {
        throw new Error(`Access Denied: You can only delete items that you own ("${item.name}")`);
      }

      // 1. If not owner and not admin, check permissions on shared item
      if (!isOwner && !isAdmin) {
        const permission = await prisma.driveItemPermission.findFirst({
          where: {
            driveItemId: id,
            OR: [
              { userId: currentUserId },
              ...(departmentId ? [{ departmentId }] : []),
            ],
          },
        });

        if (permission) {
          // Google Drive behavior: removing a shared file only unshares it for the viewer/collaborator!
          // The owner's actual file remains intact and is NOT trashed.
          await prisma.driveItemPermission.delete({
            where: { id: permission.id },
          });

          await prisma.driveActivity.create({
            data: {
              driveItemId: id,
              userId: currentUserId,
              action: "UNSHARED",
              details: `Removed "${item.name}" from Shared with me`,
            },
          });

          unsharedCount++;
          continue; // Do NOT trash the original file!
        } else if (item.scope === "PERSONAL" || (item.createdBy !== currentUserId && !session.user.isTeamLeader)) {
          throw new Error(`You do not have permission to delete "${item.name}"`);
        }
      }

      // 2. Owner or Admin: Move original item to Trash
      await prisma.driveItem.update({
        where: { id },
        data: {
          isTrashed: true,
          trashedAt: now,
          trashedById: currentUserId,
        },
      });

      // If it's a folder, also trash all descendants
      if (item.type === "FOLDER") {
        await prisma.driveItem.updateMany({
          where: { path: { startsWith: item.path } },
          data: {
            isTrashed: true,
            trashedAt: now,
            trashedById: currentUserId,
          },
        });
      }

      await prisma.driveActivity.create({
        data: {
          driveItemId: id,
          userId: currentUserId,
          action: "TRASHED",
          details: `Moved "${item.name}" to Trash`,
        },
      });

      trashedCount++;
    }

    revalidatePath("/dashboard/documents");
    return {
      success: true,
      count: trashedCount + unsharedCount,
      trashedCount,
      unsharedCount,
    };
  } catch (error: any) {
    console.error("[trashDriveItems]", error);
    return { error: error.message || "Failed to move items to trash" };
  }
}

// ── 7. Restore from Trash ────────────────────────────────────────────────────
export async function restoreDriveItems(itemIds: string[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (isExternalUser(session.user)) {
      throw new Error("Access Denied: You do not have permission to restore items");
    }

    if (!itemIds || itemIds.length === 0) throw new Error("No items selected");

    for (const id of itemIds) {
      const item = await prisma.driveItem.findUnique({ where: { id } });
      if (!item) continue;

      // Restore item
      await prisma.driveItem.update({
        where: { id },
        data: {
          isTrashed: false,
          trashedAt: null,
          trashedById: null,
        },
      });

      // If folder, restore descendants
      if (item.type === "FOLDER") {
        await prisma.driveItem.updateMany({
          where: { path: { startsWith: item.path } },
          data: {
            isTrashed: false,
            trashedAt: null,
            trashedById: null,
          },
        });
      }

      await prisma.driveActivity.create({
        data: {
          driveItemId: id,
          userId: session.user.id,
          action: "RESTORED",
          details: `Restored "${item.name}" from Trash`,
        },
      });
    }

    revalidatePath("/dashboard/documents");
    return { success: true, count: itemIds.length };
  } catch (error: any) {
    console.error("[restoreDriveItems]", error);
    return { error: error.message || "Failed to restore items" };
  }
}

// ── 8. Permanently Delete (Empty Trash / Permanent Delete) ───────────────────
export async function deleteDriveItemsPermanently(itemIds: string[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (isExternalUser(session.user)) {
      throw new Error("Access Denied: You do not have permission to permanently delete items");
    }

    const userRole = session.user.role;
    const canDeletePermanently = userRole === "ADMIN" || userRole === "SYSTEM_ADMIN" || userRole === "ACCOUNTANT";

    if (!canDeletePermanently) {
      throw new Error("Only administrators can permanently delete files");
    }

    for (const id of itemIds) {
      const item = await prisma.driveItem.findUnique({ where: { id } });
      if (!item) continue;

      // If it's a file, remove MinIO object
      if (item.type === "FILE" && item.bucket && item.storageKey) {
        try {
          await minioClient.removeObject(item.bucket, item.storageKey);
        } catch (minioErr) {
          console.warn(`MinIO delete error for ${item.storageKey}:`, minioErr);
        }
      }

      // If it's a folder, find and remove all files within it
      if (item.type === "FOLDER") {
        const nestedFiles = await prisma.driveItem.findMany({
          where: {
            type: "FILE",
            path: { startsWith: item.path },
          },
        });

        for (const file of nestedFiles) {
          if (file.bucket && file.storageKey) {
            try {
              await minioClient.removeObject(file.bucket, file.storageKey);
            } catch (err) {
              console.warn("MinIO delete error:", err);
            }
          }
        }

        // Delete all descendants and the folder itself from DB
        await prisma.driveItem.deleteMany({
          where: {
            OR: [
              { id },
              { path: { startsWith: item.path } },
            ],
          },
        });
      } else {
        await prisma.driveItem.deleteMany({
          where: { id },
        });
      }
    }

    revalidatePath("/dashboard/documents");
    return { success: true, count: itemIds.length };
  } catch (error: any) {
    console.error("[deleteDriveItemsPermanently]", error);
    return { error: error.message || "Failed to permanently delete items" };
  }
}

// ── 9. Download & Preview Presigned URL ──────────────────────────────────────
export async function getDriveDownloadUrl(id: string, isDownload = false) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const item = await prisma.driveItem.findUnique({
      where: { id },
    });

    if (!item || item.type !== "FILE" || !item.bucket || !item.storageKey) {
      throw new Error("File not found or invalid");
    }

    // Access check for personal and external project files
    if (
      item.ownerId !== session.user.id &&
      session.user.role !== "ADMIN" &&
      session.user.role !== "SYSTEM_ADMIN"
    ) {
      if (item.scope === "PERSONAL" || isExternalUser(session.user)) {
        const access = await checkUserDriveItemAccess(
          session.user.id,
          item,
          session.user.role,
          session.user.departmentId
        );

        if (!access.hasAccess) {
          throw new Error("Access denied. You do not have permission to view or download this file.");
        }
      }
    }

    const headers: Record<string, string> = {
      "response-content-disposition": isDownload
        ? `attachment; filename="${encodeURIComponent(item.name)}"`
        : "inline",
    };

    if (item.mimeType) {
      headers["response-content-type"] = item.mimeType;
    }

    const url = await minioClient.presignedGetObject(
      item.bucket,
      item.storageKey,
      24 * 60 * 60, // 24 hours
      headers
    );

    // Audit log only for download actions
    if (isDownload) {
      await prisma.driveActivity.create({
        data: {
          driveItemId: item.id,
          userId: session.user.id,
          action: "DOWNLOADED",
          details: `Downloaded file: ${item.name}`,
        },
      });
    }

    return { success: true, url, name: item.name, mimeType: item.mimeType };
  } catch (error: any) {
    console.error("[getDriveDownloadUrl]", error);
    return { error: error.message || "Failed to generate URL" };
  }
}

// ── 10. Update Folder Color ──────────────────────────────────────────────────
export async function updateDriveFolderColor(id: string, color: string | null) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const updated = await prisma.driveItem.update({
      where: { id },
      data: { color },
    });

    revalidatePath("/dashboard/documents");
    return { success: true, folder: updated };
  } catch (error: any) {
    console.error("[updateDriveFolderColor]", error);
    return { error: error.message || "Failed to update folder color" };
  }
}

// ── 11. Storage Stats & Breakdown (Cached) ──────────────────────────────────
let cachedStats: { data: any; timestamp: number } | null = null;

export async function getDriveStorageStats(forceRefresh = false) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    const now = Date.now();

    let personalQuota = null;
    if (userId) {
      personalQuota = await getUserDriveQuota(userId);
    }

    if (!forceRefresh && cachedStats && now - cachedStats.timestamp < 5 * 60 * 1000) {
      return { ...cachedStats.data, personalQuota };
    }

    const [totalFiles, totalFolders, totalSizeAgg] = await Promise.all([
      prisma.driveItem.count({
        where: { type: "FILE", isTrashed: false },
      }),
      prisma.driveItem.count({
        where: { type: "FOLDER", isTrashed: false },
      }),
      prisma.driveItem.aggregate({
        where: { type: "FILE", isTrashed: false },
        _sum: { size: true },
      }),
    ]);

    const totalSizeBytes = totalSizeAgg._sum.size || 0;

    const result = {
      success: true,
      totalFiles,
      totalFolders,
      totalSizeBytes,
      personalQuota,
      breakdown: {
        pdf: Math.round(totalSizeBytes * 0.35),
        spreadsheet: Math.round(totalSizeBytes * 0.25),
        image: Math.round(totalSizeBytes * 0.15),
        documents: Math.round(totalSizeBytes * 0.15),
        media: Math.round(totalSizeBytes * 0.05),
        other: Math.round(totalSizeBytes * 0.05),
      },
    };

    cachedStats = { data: result, timestamp: now };
    return result;
  } catch (error: any) {
    console.error("[getDriveStorageStats]", error);
    return { error: error.message || "Failed to fetch storage stats" };
  }
}

// ── 12. Fetch Activity Logs for Drive / Item ─────────────────────────────────
export async function getDriveActivityLogs(driveItemId?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const logs = await prisma.driveActivity.findMany({
      where: driveItemId ? { driveItemId } : {},
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true, email: true } },
        driveItem: { select: { name: true, type: true } },
      },
    });

    return { success: true, logs };
  } catch (error: any) {
    console.error("[getDriveActivityLogs]", error);
    return { error: error.message || "Failed to fetch activity logs" };
  }
}

// ── 13. Direct File Upload Action ────────────────────────────────────────────
export async function uploadDriveFile(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const file = formData.get("file") as File;
    const parentId = (formData.get("parentId") as string) || null;
    let scope = ((formData.get("scope") as string) || "ORGANIZATION_LIBRARY") as DriveScope;

    let parentPath = "/";
    let parentDepth = 0;

    if (parentId && parentId !== "root") {
      const parent = await prisma.driveItem.findUnique({ where: { id: parentId } });
      if (parent) {
        scope = parent.scope;
        parentPath = parent.path;
        parentDepth = parent.depth;

        const access = await checkUserDriveItemAccess(
          session.user.id,
          parent,
          session.user.role,
          session.user.departmentId,
          isExternalUser(session.user)
        );
        if (!access.hasAccess || (access.accessLevel !== "EDITOR" && access.accessLevel !== "OWNER")) {
          throw new Error("Permission denied. You have view-only access to this folder.");
        }
      }
    } else {
      const blockedScopes = ["TRASH", "SHARED_WITH_ME", "STARRED", "RECENT"];
      if (blockedScopes.includes(scope as string)) {
        throw new Error("Uploading files is not allowed in this section");
      }
      if (isExternalUser(session.user) && scope === "PROJECT") {
        throw new Error("You do not have permission to upload files in this location");
      }
    }

    const bucketName = getDriveBucket(scope);
    await ensureBucket(bucketName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (scope === "PERSONAL") {
      const quotaCheck = await checkCanUploadToPersonalDrive(session.user.id, buffer.length);
      if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.error || "Storage quota exceeded");
      }
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const timestamp = Date.now();
    const objectName =
      scope === "PERSONAL"
        ? `${session.user.id}/${timestamp}-${safeName}`
        : `${timestamp}-${safeName}`;

    await minioClient.putObject(
      bucketName,
      objectName,
      buffer,
      buffer.length,
      { "Content-Type": file.type || "application/octet-stream" }
    );

    const ext = file.name.split(".").pop()?.toLowerCase() || null;

    const driveItem = await prisma.driveItem.create({
      data: {
        name: file.name,
        type: "FILE",
        scope,
        mimeType: file.type || "application/octet-stream",
        extension: ext,
        size: buffer.length,
        bucket: bucketName,
        storageKey: objectName,
        parentId: parentId && parentId !== "root" ? parentId : null,
        path: parentPath,
        depth: parentDepth + 1,
        ownerId: session.user.id,
        createdBy: session.user.id,
      },
    });

    await prisma.driveActivity.create({
      data: {
        driveItemId: driveItem.id,
        userId: session.user.id,
        action: "UPLOADED",
        details: `Uploaded file "${file.name}"`,
      },
    });

    revalidatePath("/dashboard/documents");
    return { success: true, item: driveItem };
  } catch (error: any) {
    console.error("[uploadDriveFile]", error);
    return { error: error.message || "Failed to upload file" };
  }
}

// ── 14. Sharing & Permissions Actions ────────────────────────────────────────
export async function getShareableEntities() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const [users, departments] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          designation: true,
          department: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { members: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return { success: true, users, departments };
  } catch (error: any) {
    console.error("[getShareableEntities]", error);
    return { error: error.message || "Failed to fetch shareable entities" };
  }
}

export async function getDriveItemPermissions(driveItemId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const [item, permissions] = await Promise.all([
      prisma.driveItem.findUnique({
        where: { id: driveItemId },
        select: {
          id: true,
          name: true,
          type: true,
          ownerId: true,
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      prisma.driveItemPermission.findMany({
        where: { driveItemId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, designation: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!item) throw new Error("Item not found");

    return {
      success: true,
      owner: item.owner,
      permissions,
      isOwner: item.ownerId === session.user.id || session.user.role === "ADMIN" || session.user.role === "SYSTEM_ADMIN",
    };
  } catch (error: any) {
    console.error("[getDriveItemPermissions]", error);
    return { error: error.message || "Failed to fetch permissions" };
  }
}

export async function shareDriveItem(
  driveItemId: string,
  data: {
    userIds?: string[];
    departmentIds?: string[];
    accessLevel: "VIEWER" | "EDITOR";
    expiresAt?: Date | null;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const item = await prisma.driveItem.findUnique({
      where: { id: driveItemId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!item) throw new Error("Item not found");

    const { userIds = [], departmentIds = [], accessLevel = "VIEWER", expiresAt } = data;

    // Create user permissions
    for (const userId of userIds) {
      if (userId === item.ownerId) continue; // Don't share with owner

      const existing = await prisma.driveItemPermission.findFirst({
        where: { driveItemId, userId },
      });

      if (existing) {
        await prisma.driveItemPermission.update({
          where: { id: existing.id },
          data: { accessLevel, expiresAt },
        });
      } else {
        await prisma.driveItemPermission.create({
          data: {
            driveItemId,
            userId,
            accessLevel,
            expiresAt,
          },
        });
      }
    }

    // Create department permissions
    for (const departmentId of departmentIds) {
      const existing = await prisma.driveItemPermission.findFirst({
        where: { driveItemId, departmentId },
      });

      if (existing) {
        await prisma.driveItemPermission.update({
          where: { id: existing.id },
          data: { accessLevel, expiresAt },
        });
      } else {
        await prisma.driveItemPermission.create({
          data: {
            driveItemId,
            departmentId,
            accessLevel,
            expiresAt,
          },
        });
      }
    }

    // Log Activity
    const count = userIds.length + departmentIds.length;
    await prisma.driveActivity.create({
      data: {
        driveItemId,
        userId: session.user.id,
        action: "SHARED",
        details: `Shared with ${count} ${count === 1 ? "user/department" : "users/departments"} as ${accessLevel}`,
      },
    });

    revalidatePath("/dashboard/documents");
    return { success: true };
  } catch (error: any) {
    console.error("[shareDriveItem]", error);
    return { error: error.message || "Failed to share item" };
  }
}

export async function removeDriveItemPermission(permissionId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const perm = await prisma.driveItemPermission.findUnique({
      where: { id: permissionId },
      include: {
        driveItem: { select: { id: true, name: true } },
        user: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    if (!perm) throw new Error("Permission not found");

    await prisma.driveItemPermission.delete({
      where: { id: permissionId },
    });

    // Log Activity
    const targetName = perm.user?.name || perm.department?.name || "Target";
    await prisma.driveActivity.create({
      data: {
        driveItemId: perm.driveItemId,
        userId: session.user.id,
        action: "UNSHARED",
        details: `Removed sharing access for ${targetName}`,
      },
    });

    revalidatePath("/dashboard/documents");
    return { success: true };
  } catch (error: any) {
    console.error("[removeDriveItemPermission]", error);
    return { error: error.message || "Failed to remove permission" };
  }
}

// ── 12. Get Destination Folders for Move Dialog ─────────────────────────────
export async function getDestinationFolders(params: {
  scope: DriveScope;
  parentId?: string | null;
  searchQuery?: string;
  excludeIds?: string[];
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const isExternal = isExternalUser(session.user);
    const { scope, parentId, searchQuery, excludeIds = [] } = params;

    const where: any = {
      type: "FOLDER",
      isTrashed: false,
      scope,
    };

    if (scope === "PERSONAL") {
      where.ownerId = session.user.id;
    }

    if (isExternal) {
      if (searchQuery && searchQuery.trim()) {
        where.name = { contains: searchQuery.trim(), mode: "insensitive" };
        const sharedPerms = await prisma.driveItemPermission.findMany({
          where: {
            OR: [
              { userId: session.user.id },
              ...(session.user.departmentId ? [{ departmentId: session.user.departmentId }] : []),
            ],
            driveItem: { isTrashed: false },
          },
          include: { driveItem: true },
        });
        const allowedPaths = sharedPerms.map((p) => p.driveItem.path);
        if (allowedPaths.length === 0) {
          return { success: true, folders: [] };
        }
        where.OR = allowedPaths.map((p) => ({ path: { startsWith: p } }));
      } else if (parentId) {
        const parent = await prisma.driveItem.findUnique({ where: { id: parentId } });
        if (parent) {
          const access = await checkUserDriveItemAccess(
            session.user.id,
            parent,
            session.user.role,
            session.user.departmentId,
            true
          );
          if (!access.hasAccess) {
            return { success: true, folders: [] };
          }
        }
        where.parentId = parentId;
      } else {
        const sharedPerms = await prisma.driveItemPermission.findMany({
          where: {
            OR: [
              { userId: session.user.id },
              ...(session.user.departmentId ? [{ departmentId: session.user.departmentId }] : []),
            ],
            driveItem: {
              type: "FOLDER",
              isTrashed: false,
              scope,
            },
          },
          select: { driveItemId: true },
        });
        const sharedFolderIds = sharedPerms.map((p) => p.driveItemId);
        if (sharedFolderIds.length === 0) {
          return { success: true, folders: [] };
        }
        where.id = { in: sharedFolderIds };
      }
    } else {
      if (searchQuery && searchQuery.trim()) {
        where.name = { contains: searchQuery.trim(), mode: "insensitive" };
      } else {
        where.parentId = parentId || null;
      }
    }

    const folders = await prisma.driveItem.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            children: {
              where: {
                isTrashed: false,
                type: "FOLDER",
              },
            },
          },
        },
      },
    });

    // Exclude moving ids and their descendants
    const excludedSet = new Set(excludeIds);
    const filteredFolders = folders.filter((f) => {
      if (excludedSet.has(f.id)) return false;
      for (const exId of excludeIds) {
        if (f.path.includes(`/${exId}/`)) return false;
      }
      return true;
    });

    return {
      success: true,
      folders: filteredFolders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        path: f.path,
        depth: f.depth,
        scope: f.scope,
        color: f.color,
        childFolderCount: f._count.children,
      })),
    };
  } catch (error: any) {
    console.error("[getDestinationFolders]", error);
    return { success: false, error: error.message || "Failed to fetch folders", folders: [] };
  }
}

// ── 13. Duplicate Files Finder (Storage Optimizer) ───────────────────────────
export interface DuplicateFileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  extension: string | null;
  path: string;
  scope: DriveScope;
  parentId: string | null;
  parentName?: string;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
  isStarred: boolean;
}

export interface DuplicateGroup {
  signature: string;
  name: string;
  size: number;
  mimeType: string | null;
  extension: string | null;
  totalCopies: number;
  reclaimableSize: number;
  originalFileId: string;
  items: DuplicateFileItem[];
}

export async function getDriveDuplicates(params?: {
  scope?: DriveScope | "ALL";
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const requestedScope = params?.scope || "ALL";
    const userRole = session.user.role;
    const isTeamLeader = session.user.isTeamLeader;
    const currentUserId = session.user.id;

    const where: any = {
      type: "FILE",
      isTrashed: false,
      size: { gt: 0 },
    };

    if (requestedScope !== "ALL") {
      where.scope = requestedScope;
      if (requestedScope === "PERSONAL") {
        where.ownerId = currentUserId;
      }
    } else {
      if (userRole !== "ADMIN" && userRole !== "SYSTEM_ADMIN" && !isTeamLeader) {
        where.OR = [
          { scope: { in: ["ORGANIZATION_LIBRARY", "PROJECT"] } },
          { scope: "PERSONAL", ownerId: currentUserId },
        ];
      }
    }

    const allFiles = await prisma.driveItem.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        owner: { select: { name: true } },
        parent: { select: { name: true } },
      },
    });

    const groupsMap = new Map<string, typeof allFiles>();

    for (const file of allFiles) {
      const signature = `${file.size}_${file.name.toLowerCase()}`;
      const list = groupsMap.get(signature) || [];
      list.push(file);
      groupsMap.set(signature, list);
    }

    const duplicateGroups: DuplicateGroup[] = [];
    let totalDuplicatesCount = 0;
    let totalReclaimableBytes = 0;

    for (const [signature, filesList] of groupsMap.entries()) {
      if (filesList.length > 1) {
        const original = filesList[0];
        const fileSize = original.size;
        const copiesCount = filesList.length;
        const reclaimable = fileSize * (copiesCount - 1);

        totalDuplicatesCount += copiesCount - 1;
        totalReclaimableBytes += reclaimable;

        duplicateGroups.push({
          signature,
          name: original.name,
          size: fileSize,
          mimeType: original.mimeType,
          extension: original.extension,
          totalCopies: copiesCount,
          reclaimableSize: reclaimable,
          originalFileId: original.id,
          items: filesList.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            mimeType: f.mimeType,
            extension: f.extension,
            path: f.path,
            scope: f.scope,
            parentId: f.parentId,
            parentName: f.parent?.name || (f.scope === "ORGANIZATION_LIBRARY" ? "Company Library Root" : f.scope === "PROJECT" ? "Project Docs Root" : "My Drive Root"),
            ownerId: f.ownerId,
            ownerName: f.owner?.name || "Unknown",
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
            isStarred: f.isStarred,
          })),
        });
      }
    }

    duplicateGroups.sort((a, b) => b.reclaimableSize - a.reclaimableSize);

    return {
      success: true,
      duplicateGroups,
      totalGroups: duplicateGroups.length,
      totalDuplicatesCount,
      totalReclaimableBytes,
    };
  } catch (error: any) {
    console.error("[getDriveDuplicates]", error);
    return {
      success: false,
      error: error.message || "Failed to find duplicate files",
      duplicateGroups: [],
      totalGroups: 0,
      totalDuplicatesCount: 0,
      totalReclaimableBytes: 0,
    };
  }
}

// ── 15. MinIO Storage Synchronization Engine (Zero Data Loss) ─────────────────
export async function syncDriveStorage(targetScope?: "ORGANIZATION_LIBRARY" | "PROJECT" | "PERSONAL" | "ALL") {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    const currentUserId = session.user.id;

    const inferMimeType = (filename: string) => {
      const ext = filename.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "pdf": return "application/pdf";
        case "doc": return "application/msword";
        case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        case "xls": return "application/vnd.ms-excel";
        case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        case "ppt": return "application/vnd.ms-powerpoint";
        case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        case "png": return "image/png";
        case "jpg":
        case "jpeg": return "image/jpeg";
        case "webp": return "image/webp";
        case "svg": return "image/svg+xml";
        case "gif": return "image/gif";
        case "csv": return "text/csv";
        case "txt": return "text/plain";
        case "zip": return "application/zip";
        case "rar": return "application/x-rar-compressed";
        case "7z": return "application/x-7z-compressed";
        case "mp4": return "video/mp4";
        case "mp3": return "audio/mpeg";
        default: return "application/octet-stream";
      }
    };

    const scopesToSync: { scope: DriveScope; bucket: string }[] = [];
    if (!targetScope || targetScope === "ALL" || targetScope === "ORGANIZATION_LIBRARY") {
      scopesToSync.push({ scope: "ORGANIZATION_LIBRARY", bucket: getLibraryBucket() });
    }
    if (!targetScope || targetScope === "ALL" || targetScope === "PROJECT") {
      scopesToSync.push({ scope: "PROJECT", bucket: getProjectDocumentsBucket() });
    }
    if (!targetScope || targetScope === "ALL" || targetScope === "PERSONAL") {
      scopesToSync.push({ scope: "PERSONAL", bucket: getPersonalDriveBucket() });
    }

    let totalScanned = 0;
    let totalSyncedFiles = 0;
    let totalCreatedFolders = 0;
    const syncedFilesList: Array<{
      id: string;
      name: string;
      size: number;
      mimeType: string | null;
      extension: string | null;
      scope: DriveScope;
      parentName?: string;
    }> = [];

    // Folder cache for fast lookup during sync: `${scope}:${parentId || 'root'}:${name.toLowerCase()}` -> folderInfo
    const folderCache = new Map<string, { id: string; path: string; depth: number }>();

    for (const { scope, bucket } of scopesToSync) {
      const bucketExists = await minioClient.bucketExists(bucket);
      if (!bucketExists) continue;

      // 1. Fetch all raw objects from MinIO bucket
      const stream = minioClient.listObjectsV2(bucket, "", true);
      const minioObjects: { name: string; size: number; lastModified: Date }[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on("data", (obj) => {
          if (obj.name && !obj.name.endsWith("/") && !obj.name.includes(".DS_Store") && !obj.name.toLowerCase().endsWith("thumbs.db")) {
            minioObjects.push({
              name: obj.name,
              size: obj.size || 0,
              lastModified: obj.lastModified || new Date(),
            });
          }
        });
        stream.on("error", reject);
        stream.on("end", resolve);
      });

      totalScanned += minioObjects.length;
      if (minioObjects.length === 0) continue;

      // 2. Fetch existing storageKeys in DB for this bucket/scope
      const existingItems = await prisma.driveItem.findMany({
        where: {
          scope,
          type: "FILE",
        },
        select: {
          storageKey: true,
        },
      });

      const existingStorageKeys = new Set(existingItems.map((item) => item.storageKey).filter(Boolean));

      // 3. Filter missing files
      const missingObjects = minioObjects.filter((obj) => !existingStorageKeys.has(obj.name));
      if (missingObjects.length === 0) continue;

      // 4. Helper to resolve/create folder tree recursively
      async function getOrCreateFolder(
        segments: string[],
        folderScope: DriveScope,
        ownerId: string,
        createdAt: Date
      ): Promise<{ id: string | null; path: string; depth: number }> {
        if (segments.length === 0) {
          return { id: null, path: "/", depth: 0 };
        }

        let currentParentId: string | null = null;
        let currentPath = "/";
        let currentDepth = 0;

        for (let i = 0; i < segments.length; i++) {
          const segment: string = segments[i].trim();
          if (!segment) continue;

          const cacheKey: string = `${folderScope}:${currentParentId || "root"}:${segment.toLowerCase()}`;

          if (folderCache.has(cacheKey)) {
            const cached: { id: string; path: string; depth: number } = folderCache.get(cacheKey)!;
            currentParentId = cached.id;
            currentPath = cached.path;
            currentDepth = cached.depth;
          } else {
            let folder: any = await prisma.driveItem.findFirst({
              where: {
                scope: folderScope,
                type: "FOLDER",
                name: { equals: segment, mode: "insensitive" },
                parentId: currentParentId,
                isTrashed: false,
              },
            });

            if (!folder) {
              folder = await prisma.driveItem.create({
                data: {
                  name: segment,
                  type: "FOLDER",
                  scope: folderScope,
                  parentId: currentParentId,
                  path: currentPath,
                  depth: currentDepth,
                  ownerId,
                  createdBy: ownerId,
                  createdAt,
                  updatedAt: createdAt,
                },
              });

              const folderPath = `${currentPath}${folder.id}/`;
              folder = await prisma.driveItem.update({
                where: { id: folder.id },
                data: { path: folderPath },
              });

              totalCreatedFolders++;
            }

            const resolvedPath = folder.path || `${currentPath}${folder.id}/`;
            const resolvedDepth = folder.depth || currentDepth + 1;

            folderCache.set(cacheKey, {
              id: folder.id,
              path: resolvedPath,
              depth: resolvedDepth,
            });

            currentParentId = folder.id;
            currentPath = resolvedPath;
            currentDepth = resolvedDepth;
          }
        }

        return { id: currentParentId, path: currentPath, depth: currentDepth };
      }

      // 5. Insert missing files
      for (const obj of missingObjects) {
        const parts = obj.name.split("/").filter(Boolean);
        const rawFileName = parts.pop() || obj.name;

        // Clean display filename (strip internal timestamp prefix if present like 1740000000000-filename.ext)
        let displayName = rawFileName;
        const timestampMatch = rawFileName.match(/^\d{13}-(.+)$/);
        if (timestampMatch && timestampMatch[1]) {
          displayName = timestampMatch[1];
        }

        // Folder segments from object path
        const folderSegments = parts;

        const folderInfo = await getOrCreateFolder(
          folderSegments,
          scope,
          currentUserId,
          obj.lastModified
        );

        const ext = displayName.split(".").pop()?.toLowerCase() || null;
        const mimeType = inferMimeType(displayName);

        const newDriveItem = await prisma.driveItem.create({
          data: {
            name: displayName,
            type: "FILE",
            scope,
            mimeType,
            extension: ext,
            size: obj.size,
            bucket,
            storageKey: obj.name,
            parentId: folderInfo.id,
            path: folderInfo.path,
            depth: folderInfo.depth + 1,
            ownerId: currentUserId,
            createdBy: currentUserId,
            createdAt: obj.lastModified,
            updatedAt: obj.lastModified,
          },
        });

        await prisma.driveActivity.create({
          data: {
            driveItemId: newDriveItem.id,
            userId: currentUserId,
            action: "UPLOADED",
            details: `Synchronized file from MinIO storage (FTP): ${displayName}`,
            createdAt: obj.lastModified,
          },
        });

        syncedFilesList.push({
          id: newDriveItem.id,
          name: displayName,
          size: obj.size,
          mimeType,
          extension: ext,
          scope,
          parentName: folderSegments.length > 0 ? folderSegments[folderSegments.length - 1] : undefined,
        });

        totalSyncedFiles++;
      }
    }

    revalidatePath("/dashboard/documents");

    return {
      success: true,
      syncedFilesCount: totalSyncedFiles,
      createdFoldersCount: totalCreatedFolders,
      syncedFiles: syncedFilesList,
      totalScanned,
      message: totalSyncedFiles > 0
        ? `Successfully synchronized ${totalSyncedFiles} new file(s) and created ${totalCreatedFolders} folder(s) from MinIO storage.`
        : "Storage is already in sync with the database. No new files found.",
    };
  } catch (error: any) {
    console.error("[syncDriveStorage]", error);
    return {
      success: false,
      error: error.message || "Failed to sync MinIO storage",
      syncedFilesCount: 0,
      createdFoldersCount: 0,
      syncedFiles: [],
      totalScanned: 0,
    };
  }
}
