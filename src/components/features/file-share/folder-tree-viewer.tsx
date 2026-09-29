"use client";

import { useState } from "react";
import { FileIcon, FolderIcon, DownloadIcon, ChevronDown, ChevronRight } from "lucide-react";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface SharedFile {
  relativeName: string;
  size: number;
  downloadUrl: string;
}

interface TreeNode {
  name: string;
  type: 'file' | 'folder';
  size?: number;
  downloadUrl?: string;
  children: Record<string, TreeNode>;
}

export function FolderTreeViewer({ files, shareId }: { files: SharedFile[], shareId: string }) {
  // Build the tree structure
  const buildTree = () => {
    const root: TreeNode = { name: 'root', type: 'folder', children: {} };

    files.forEach(file => {
      const parts = file.relativeName.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          // It's a file
          current.children[part] = {
            name: part,
            type: 'file',
            size: file.size,
            downloadUrl: file.downloadUrl,
            children: {}
          };
        } else {
          // It's a folder
          const folderPath = parts.slice(0, i + 1).join('/');
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              type: 'folder',
              downloadUrl: `/api/p/${shareId}?action=zip&folder=${encodeURIComponent(folderPath)}`,
              children: {}
            };
          }
          current = current.children[part];
        }
      }
    });

    return root;
  };

  const tree = buildTree();

  return (
    <div className="w-full bg-white rounded-lg overflow-hidden border border-gray-100">
      {Object.keys(tree.children).length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {Object.entries(tree.children).map(([name, node]) => (
            <TreeNodeItem key={name} node={node} level={0} />
          ))}
        </ul>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">This folder is currently empty.</p>
        </div>
      )}
    </div>
  );
}

function TreeNodeItem({ node, level }: { node: TreeNode; level: number }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    }
  };

  const paddingLeft = `${level * 1.5 + 1}rem`;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  if (node.type === 'folder') {
    return (
      <li>
        <div 
          className="flex items-center justify-between py-3 sm:py-2.5 px-4 hover:bg-gray-50 cursor-pointer transition-colors group border-l-2 border-transparent hover:border-blue-500"
          style={{ paddingLeft }}
          onClick={toggleOpen}
        >
          <div className="flex items-center space-x-3 truncate flex-1 min-w-0">
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <FolderIcon className="w-5 h-5 text-blue-500 shrink-0" />
            <p className="text-sm font-medium text-gray-900 truncate" title={node.name}>{node.name}</p>
          </div>
          
          {node.downloadUrl && (
            <a
              href={node.downloadUrl}
              download
              className="flex items-center p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors shrink-0 ml-2"
              onClick={(e) => e.stopPropagation()}
              title="Download Folder as ZIP"
            >
              <DownloadIcon className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">ZIP</span>
            </a>
          )}
        </div>
        {isOpen && Object.keys(node.children).length > 0 && (
          <ul className="divide-y divide-gray-50 border-t border-gray-50">
            {Object.entries(node.children).map(([childName, childNode]) => (
              <TreeNodeItem key={childName} node={childNode} level={level + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // File node
  return (
    <li>
      <div 
        className="flex items-center justify-between py-3 sm:py-2.5 px-4 hover:bg-gray-50 transition-colors group gap-2 sm:gap-4 border-l-2 border-transparent"
        style={{ paddingLeft }}
      >
        <div className="flex items-center space-x-3 truncate flex-1 min-w-0">
          <div className="w-4 h-4 shrink-0" /> {/* Spacer for alignment with folder chevron */}
          <FileIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0" />
          <div className="truncate">
            <p className="text-sm font-medium text-gray-900 truncate" title={node.name}>{node.name}</p>
            {node.size !== undefined && (
              <p className="text-xs text-gray-500">{formatBytes(node.size)}</p>
            )}
          </div>
        </div>
        
        {node.downloadUrl && (
          <a
            href={node.downloadUrl}
            download
            className="flex items-center p-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Download"
          >
            <DownloadIcon className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Download</span>
          </a>
        )}
      </div>
    </li>
  );
}
