import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTree,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { FileTreeNode, TocHeading } from '../../shared/types';

interface SidebarProps {
  activeTab: 'files' | 'outline';
  onChangeTab: (tab: 'files' | 'outline') => void;
  workspacePath: string | null;
  fileTree: FileTreeNode[];
  activeFilePath: string | null;
  headings: TocHeading[];
  onOpenFolder: () => void;
  onRefreshFolder: () => void;
  onOpenFileFromTree: (filePath: string) => void;
  onCreateFile: (parentDir: string, name: string) => Promise<void>;
  onCreateFolder: (parentDir: string, name: string) => Promise<void>;
  onDeletePath: (targetPath: string) => Promise<void>;
  onSelectHeading: (headingId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  workspacePath,
  fileTree,
  activeFilePath,
  headings,
  onOpenFolder,
  onRefreshFolder,
  onOpenFileFromTree,
  onCreateFile,
  onCreateFolder,
  onDeletePath,
  onSelectHeading,
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [creatingKind, setCreatingKind] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspacePath || !newName.trim() || !creatingKind) return;
    if (creatingKind === 'file') {
      await onCreateFile(workspacePath, newName.trim());
    } else {
      await onCreateFolder(workspacePath, newName.trim());
    }
    setNewName('');
    setCreatingKind(null);
  };

  const folderDisplayName = workspacePath
    ? workspacePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() || workspacePath
    : null;

  const renderNode = (node: FileTreeNode, depth: number) => {
    const isExpanded = Boolean(expandedDirs[node.path]);
    const isActive = activeFilePath === node.path;
    const isMarkdown = /\.(md|markdown|mdx|txt)$/i.test(node.name);

    return (
      <div key={node.path}>
        <div
          onClick={() => {
            if (node.isDirectory) {
              toggleDir(node.path);
            } else if (isMarkdown) {
              onOpenFileFromTree(node.path);
            }
          }}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
          className={`group flex items-center justify-between pr-2 py-1 rounded-md text-xs transition-colors select-none ${
            node.isDirectory || isMarkdown ? 'cursor-pointer' : 'opacity-50 cursor-default'
          } ${
            isActive
              ? 'bg-indigo-500/12 text-indigo-500 font-medium'
              : 'text-[var(--letra-fg)] hover:bg-[var(--letra-hover)]'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {node.isDirectory ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--letra-muted)] shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--letra-muted)] shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500/90 shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                )}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                <FileText className="w-3.5 h-3.5 text-[var(--letra-muted)] shrink-0" />
              </>
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <button
            type="button"
            title="Move to Trash"
            onClick={(e) => {
              e.stopPropagation();
              onDeletePath(node.path);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--letra-muted)] hover:text-rose-500 transition-opacity cursor-pointer shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {node.isDirectory && isExpanded && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex flex-col h-full w-full bg-[var(--letra-chrome-bg)] border-r border-[var(--letra-border)] select-none overflow-hidden">
      {/* Sidebar Segmented Header */}
      <div className="flex items-center gap-1 p-2 border-b border-[var(--letra-border)] shrink-0">
        <button
          type="button"
          onClick={() => onChangeTab('files')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'files'
              ? 'bg-[var(--letra-elevated)] text-[var(--letra-fg)] shadow-xs ring-1 ring-[var(--letra-border)]'
              : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)]'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Files</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('outline')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'outline'
              ? 'bg-[var(--letra-elevated)] text-[var(--letra-fg)] shadow-xs ring-1 ring-[var(--letra-border)]'
              : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)]'
          }`}
        >
          <ListTree className="w-3.5 h-3.5" />
          <span>Outline</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'files' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {workspacePath ? (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--letra-border)]/70">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider text-[var(--letra-muted)] truncate"
                  title={workspacePath}
                >
                  {folderDisplayName}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    title="New Markdown File"
                    onClick={() => {
                      setCreatingKind('file');
                      setNewName('');
                    }}
                    className="p-1 rounded text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="New Folder"
                    onClick={() => {
                      setCreatingKind('folder');
                      setNewName('');
                    }}
                    className="p-1 rounded text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Refresh Folder"
                    onClick={onRefreshFolder}
                    className="p-1 rounded text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {creatingKind && (
                <form onSubmit={handleConfirmCreate} className="p-2 border-b border-[var(--letra-border)]">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={() => setCreatingKind(null)}
                    placeholder={creatingKind === 'file' ? 'notes.md' : 'folder-name'}
                    className="w-full px-2 py-1 text-xs rounded-md border border-indigo-500 bg-[var(--letra-input-bg)] text-[var(--letra-fg)] focus:outline-none"
                  />
                </form>
              )}

              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {fileTree.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-[var(--letra-muted)]">
                    Empty folder
                  </div>
                ) : (
                  fileTree.map((node) => renderNode(node, 0))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--letra-hover)] flex items-center justify-center text-[var(--letra-muted)]">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--letra-fg)]">No folder open</p>
                <p className="text-[11px] text-[var(--letra-muted)] mt-1 leading-relaxed">
                  Open a local folder to browse and organize your Markdown documents.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenFolder}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors cursor-pointer"
              >
                Open Folder…
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {headings.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-[var(--letra-muted)]">
              Add headings (<code className="font-mono"># Title</code>) to see your live document outline.
            </div>
          ) : (
            <nav aria-label="Document Outline" className="space-y-0.5">
              {headings.map((h, idx) => (
                <button
                  key={`${h.id}-${idx}`}
                  type="button"
                  onClick={() => onSelectHeading(h.id)}
                  style={{ paddingLeft: `${8 + Math.max(0, h.level - 1) * 12}px` }}
                  className="block w-full text-left pr-2 py-1.5 rounded-md text-xs text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] truncate transition-colors cursor-pointer"
                >
                  <span className={h.level === 1 ? 'font-semibold text-[var(--letra-fg)]' : ''}>
                    {h.text}
                  </span>
                </button>
              ))}
            </nav>
          )}
        </div>
      )}
    </aside>
  );
};
