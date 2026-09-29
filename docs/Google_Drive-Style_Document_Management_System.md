# Google Drive-Style Document Management System: Architecture & Zero-Data-Loss Migration Plan

## Executive Summary
This document outlines the architectural blueprint and zero-data-loss migration plan to upgrade the existing Sigma HRMS Document Management system (currently split across `LibraryDocument`, `ProjectDocument`, and `FileShare`) into a unified, enterprise-grade **Google Drive-like Document Management Platform**.

The new architecture introduces full folder hierarchy trees, drag-and-drop navigation, granular access control/sharing, starred files, trash/recycle bin with recovery, search filters, document versioning, activity audit logs, and rich previewers—all while ensuring **100% preservation of all existing files and database records**.

---

## 1. Current State vs. Target Architecture

| Feature | Current State | Target Google Drive Architecture |
| :--- | :--- | :--- |
| **Data Models** | Split `LibraryDocument` & `ProjectDocument` models with simulated slash string `category` | Unified, hierarchical `DriveItem` model supporting both `FILE` and `FOLDER` with self-referencing tree & materialized paths |
| **Storage & MinIO** | MinIO buckets (`library`, `project-documents`) | Re-uses existing MinIO object paths seamlessly without moving/re-uploading physical files |
| **Folder Support** | String matching on `category` column (brittle, flat) | First-class Folders (`type: FOLDER`), color coding, nested tree navigation, subfolder counts |
| **Trash & Recovery** | Hard delete (instantly deletes from MinIO and DB) | Soft delete (`isTrashed`, `trashedAt`, `trashedBy`) with 30-day retention, Restore, and Permanent Delete |
| **Navigation & UI** | Two duplicate 1800-line monolithic client components | Modern Drive Layout: Left navigation (My Drive, Library, Projects, Shared with me, Starred, Recent, Trash), Breadcrumbs, Grid/List view, Details Info panel |
| **Permissions & Sharing** | Hardcoded role checks (`ADMIN`, `ACCOUNTANT`, `TL`) | Granular access control (`DriveItemPermission`: View, Comment, Edit, Admin), user/department sharing, and expiring public links |
| **File Operations** | Upload, single rename, delete, download | Drag-and-drop file upload, drag-to-move, multi-select bulk actions (Move, Download ZIP, Star, Trash), Duplicate |
| **Versions & Audit** | Basic text logs in `ActivityLog` | Comprehensive `DriveActivity` timeline and `DocumentVersion` history for file revisions |
| **Search & Filters** | Simple name search string | Advanced search: by Name, File Type (PDF, Spreadsheet, Image, etc.), Date Modified, Owner, Starred status |

---

## 2. Database Schema Design (Prisma)

To ensure zero downtime and zero data loss, the new models will be added alongside existing tables. Legacy tables will be preserved as backups during migration.

```prisma
// ── Unified Google Drive Model ──────────────────────────────────────────────────

enum DriveItemType {
  FILE
  FOLDER
}

enum DriveScope {
  ORGANIZATION_LIBRARY // Replaces / migrates LibraryDocument
  PROJECT              // Replaces / migrates ProjectDocument
  PERSONAL             // User's personal "My Drive"
  DEPARTMENT           // Shared Department Drive
}

enum DriveAccessLevel {
  VIEWER
  COMMENTER
  EDITOR
  ADMIN
}

model DriveItem {
  id               String          @id @default(cuid())
  name             String
  type             DriveItemType   @default(FILE)
  scope            DriveScope      @default(ORGANIZATION_LIBRARY)
  
  // File details (null for FOLDER)
  mimeType         String?
  extension        String?
  size             BigInt          @default(0)
  bucket           String?         @default("library")
  storageKey       String?         // MinIO object name
  
  // Folder Hierarchy Tree
  parentId         String?
  parent           DriveItem?      @relation("FolderHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children         DriveItem[]     @relation("FolderHierarchy")
  path             String          @default("/") // Materialized path for fast recursive queries e.g., "/root-id/sub-id/"
  depth            Int             @default(0)
  color            String?         // Custom folder color (e.g. #3b82f6)
  
  // Ownership & Timestamps
  ownerId          String
  owner            User            @relation("DriveItemOwner", fields: [ownerId], references: [id])
  createdBy        String
  lastModifiedById String?
  lastModifiedBy   User?           @relation("DriveItemModifier", fields: [lastModifiedById], references: [id])
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  // Status & Trash
  isStarred        Boolean         @default(false)
  isTrashed        Boolean         @default(false)
  trashedAt        DateTime?
  trashedById      String?
  trashedBy        User?           @relation("DriveItemTrashedBy", fields: [trashedById], references: [id])

  // Metadata & Tags
  description      String?
  tags             String[]        @default([])
  version          Int             @default(1)
  
  // Migration & Backward Compatibility traceability
  legacyId         String?         // Original id from LibraryDocument / ProjectDocument
  legacySource     String?         // "LibraryDocument" | "ProjectDocument" | "FileShare"

  // Relations
  permissions      DriveItemPermission[]
  starredBy        DriveStarredItem[]
  versions         DriveVersion[]
  activities       DriveActivity[]

  @@index([parentId])
  @@index([scope])
  @@index([ownerId])
  @@index([isTrashed])
  @@index([isStarred])
  @@index([type])
  @@index([path])
  @@index([legacyId])
}

model DriveStarredItem {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  driveItemId String
  driveItem   DriveItem @relation(fields: [driveItemId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())

  @@unique([userId, driveItemId])
  @@index([userId])
}

model DriveItemPermission {
  id           String           @id @default(cuid())
  driveItemId  String
  driveItem    DriveItem        @relation(fields: [driveItemId], references: [id], onDelete: Cascade)
  
  // Target: User, Department, or Public
  userId       String?
  user         User?            @relation(fields: [userId], references: [id], onDelete: Cascade)
  departmentId String?
  department   Department?      @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  
  accessLevel  DriveAccessLevel @default(VIEWER)
  isPublic     Boolean          @default(false)
  publicToken  String?          @unique
  expiresAt    DateTime?
  passwordHash String?

  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([driveItemId])
  @@index([userId])
  @@index([departmentId])
  @@index([publicToken])
}

model DriveVersion {
  id          String    @id @default(cuid())
  driveItemId String
  driveItem   DriveItem @relation(fields: [driveItemId], references: [id], onDelete: Cascade)
  version     Int
  storageKey  String
  bucket      String
  size        BigInt
  mimeType    String?
  uploadedById String
  uploadedBy  User      @relation(fields: [uploadedById], references: [id])
  changeNotes String?
  createdAt   DateTime  @default(now())

  @@index([driveItemId])
}

model DriveActivity {
  id          String    @id @default(cuid())
  driveItemId String?
  driveItem   DriveItem? @relation(fields: [driveItemId], references: [id], onDelete: SetNull)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  action      String    // UPLOADED | CREATED_FOLDER | RENAMED | MOVED | TRASHED | RESTORED | DELETED_PERMANENTLY | SHARED | DOWNLOADED | STARRED
  details     String?
  createdAt   DateTime  @default(now())

  @@index([driveItemId])
  @@index([userId])
  @@index([createdAt])
}
```

---

## 3. Zero-Data-Loss Migration Strategy

```
Existing State:
┌─────────────────────────┐     ┌─────────────────────────┐
│ LibraryDocument (DB)    │     │ ProjectDocument (DB)    │
│ category: "HR/2026/PDF" │     │ category: "Alpha/Draw"  │
│ bucket: "library"       │     │ bucket: "project-docs"  │
└────────────┬────────────┘     └────────────┬────────────┘
             │                               │
             ▼                               ▼
       [ Idempotent Data Migration Script (scripts/migrate-drive.ts) ]
             │                               │
             ├───────────────────────────────┤
             ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│ MinIO Objects untouched (Zero re-uploading / zero risk) │
└─────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ DriveItem Tree:                                         │
│ 📁 HR (type: FOLDER, scope: ORGANIZATION_LIBRARY)       │
│    └── 📁 2026 (type: FOLDER)                          │
│         └── 📄 document.pdf (type: FILE, bucket: library)│
│ 📁 Alpha (type: FOLDER, scope: PROJECT)                 │
│    └── 📄 drawing.dwg (type: FILE, bucket: project-docs)│
└─────────────────────────────────────────────────────────┘
```

### Migration Execution Plan:
1. **Non-Destructive Schema Migration**: Run `npx prisma db push` or `prisma migrate` to create new tables without altering/dropping legacy tables.
2. **Automated Migration Script (`src/scripts/migrate-documents-to-drive.ts`)**:
   - Loops over all `LibraryDocument` records:
     - Splits `category` into folder segments (e.g., `HR/Policies/2026`).
     - Recursively creates parent/child `DriveItem` folders under `scope: ORGANIZATION_LIBRARY` if they don't already exist.
     - Creates the `DriveItem` file record with `parentId` set to the deepest folder, preserving original `uploadedBy`, `fileUrl` (storageKey), `size`, `createdAt`, `updatedAt`, and storing `legacyId = original.id`.
   - Loops over all `ProjectDocument` records:
     - Performs the same hierarchical folder creation under `scope: PROJECT`.
     - Creates file records preserving all metadata and MinIO storage keys.
   - Script is **100% idempotent**: Can be run multiple times safely without duplicate records (checks by `legacyId` / `storageKey`).
3. **Verification & Audit**: Run validation queries comparing:
   - Total files count before vs after.
   - Total storage bytes before vs after.
   - MinIO object link validity check.
4. **Storage Sync Engine Integration**: Maintain the automatic sync from MinIO storage (`syncDriveStorage()`) so any FTP/external uploads continue working effortlessly.

---

## 4. Google Drive-Style UI/UX Design

The user interface will be completely upgraded to match modern Google Drive aesthetics with a responsive, high-performance, polished layout:

### A. Navigation & Views (Left Sidebar):
- **🗂️ My Drive**: Private user workspace.
- **🏢 Organization Library**: Company-wide documents, policies, templates, HR forms (migrated from Library).
- **🚀 Project Documents**: Client projects, site drawings, contracts, technical specifications (migrated from Project Documents).
- **👥 Shared with Me**: Documents shared specifically with the current user or their department.
- **⭐ Starred**: Quick access to bookmarked files and folders.
- **🕒 Recent**: Files viewed, uploaded, or edited in the last 30 days.
- **🗑️ Trash**: Soft-deleted files with one-click restore or empty trash.
- **📊 Storage Overview Widget**: Visual progress bar showing used storage and breakdown by category (PDF, Spreadsheet, Media, Documents, Other).

### B. Top Header & Action Bar:
- **Global Drive Search**:
  - Live search by filename, extension, or tag.
  - Dropdown filter panel: Filter by Type (All, PDF, Spreadsheets, Presentations, Images, Archives), Owner, Modified Date (Today, Last 7 days, Last 30 days, Custom), Location.
- **Action Buttons**:
  - `+ New` Dropdown button: New Folder, Upload Files, Upload Folder.
  - Layout toggle: Grid View (large thumbnail cards with preview) vs. List View (detailed table).
  - Storage Sync button (one-click sync with MinIO).

### C. Folder & File Explorer:
- **Interactive Breadcrumb Path**: Clickable navigation trail (`Projects > 2026 > Site Drawings`) with drop targets.
- **Folder Section**: Grid of folder cards with custom color accents, item count, and quick menu.
- **File Section**:
  - Card view with rich preview banners, file extension badges, file size, and owner avatar.
  - Table view with sortable columns: Name, Owner, Last Modified, File Size, Actions.
- **Selection & Multi-Select**:
  - Checkbox selection, Shift-click range selection, marquee drag select.
  - Floating Bulk Action Toolbar: Move Selected, Download as ZIP, Star Selected, Trash Selected.

### D. Right-Side Info & Activity Inspector:
- Slide-over / docked drawer showing:
  - **Details Tab**: Live preview, file size, MIME type, storage location, creation/modification date, owner info, access permissions.
  - **Activity Tab**: Chronological audit log showing who viewed, modified, renamed, or shared the item.

### E. Rich File Previewers:
- **PDF Viewer**: Built-in full-featured viewer with zoom, page navigation, and download.
- **Excel / Spreadsheet Viewer**: Enhanced multi-sheet table viewer with formulas, sorting, and cell styling.
- **Word / DOCX / Text Viewer**: Formatted document render.
- **Media Viewer**: High-definition image, video, and audio players.
- **Share Dialog**: Google Drive-like sharing modal with user picker, permission level selector (Viewer, Commenter, Editor), expiration date, and copyable public link.

---

## 5. Phased Implementation Roadmap

### Phase 1: Database & Migration Engine
1. Update `prisma/schema.prisma` with `DriveItem`, `DriveItemPermission`, `DriveStarredItem`, `DriveVersion`, `DriveActivity`.
2. Generate Prisma Client and apply schema migration.
3. Build idempotent migration script `src/scripts/migrate-documents-to-drive.ts`.
4. Run migration script and verify that all library and project documents are accurately mirrored into `DriveItem` hierarchy without data loss.

### Phase 2: Server Actions & API Layer
1. Create `src/actions/drive.ts`:
   - `getDriveItems(scope, folderId, filter)`
   - `createDriveFolder(name, parentId, scope, color)`
   - `uploadDriveFiles(files, parentId, scope)` (with Presigned MinIO upload support)
   - `moveDriveItems(itemIds, targetFolderId)`
   - `renameDriveItem(id, newName)`
   - `toggleStarDriveItem(id)`
   - `trashDriveItems(itemIds)` & `restoreDriveItems(itemIds)` & `deleteDriveItemsPermanently(itemIds)`
   - `downloadDriveItem(id)` & `downloadDriveItemsAsZip(itemIds)`
   - `shareDriveItem(id, permissions)`
   - `syncDriveStorage(scope)`
2. Add API endpoints for Presigned URLs, Zip streaming, and public share links (`/api/drive/...`).

### Phase 3: Drive UI Components & Layout
1. Build `DriveLayout` with Sidebar, Breadcrumbs, Storage widget, and Top Toolbar.
2. Build `DriveExplorer`:
   - `DriveFolderGrid` / `DriveFolderCard`
   - `DriveFileList` / `DriveFileCard`
   - Context Menus (Right-click on file/folder)
   - Multi-select & floating action bar
3. Build Drag & Drop Handlers:
   - Drag files from desktop into browser folder
   - Drag files/folders into breadcrumbs or folder cards to move them
4. Build `DriveDetailsSidebar` with Details & Activity timeline.
5. Build `DriveShareModal` and `DriveNewFolderModal`.

### Phase 4: Integration, Verification & Legacy Compatibility
1. Update `/dashboard/documents` to render the new Google Drive experience with seamless tab switching between Company Library, Project Documents, Personal Drive, and Trash.
2. Verify all existing documents and folders display correctly.
3. Test Excel, PDF, and Image previews.
4. Run end-to-end tests for upload, move, rename, star, trash, restore, and MinIO storage synchronization.

---

## Verification Plan

### Automated Verification
- Verify database migration by running count checks between legacy and new tables.
- Execute unit/integration tests for drive actions (folder creation, file move, trash/restore).
- Verify MinIO bucket connectivity and presigned URL generation.

### Manual Verification
- **Data Integrity Check**: Verify every existing document is accessible, downloadable, and placed in the appropriate folder tree.
- **Google Drive Navigation**: Test folder creation, drill-down, breadcrumb navigation, and back/forward browser history.
- **Drag & Drop**: Test dragging files from desktop to upload directly into the active folder; test dragging items into folders.
- **Multi-Select & Bulk Operations**: Select multiple files/folders, move them to another folder, download as ZIP, and trash/restore.
- **Search & Filters**: Test search query matching, file type filters, and starred filters.
- **Previewers**: Test opening PDF, XLSX, Word, Image, and Text files directly within the app.
