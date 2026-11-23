import React from 'react';
import { FolderArchive, Link2, Lock } from 'lucide-react';
import type { AssetStorageMode, PreviewMode, ViewMode } from '../../shared/types';

interface StatusBarProps {
  filePath: string | null;
  wordCount: number;
  charCount: number;
  readingTimeMin: number;
  pageCount: number;
  previewMode: PreviewMode;
  viewMode: ViewMode;
  syncScroll: boolean;
  onToggleSyncScroll: () => void;
  assetStorageMode: AssetStorageMode;
  onToggleAssetStorageMode: () => void;
  toastMessage: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  filePath,
  wordCount,
  charCount,
  readingTimeMin,
  pageCount,
  previewMode,
  viewMode,
  syncScroll,
  onToggleSyncScroll,
  assetStorageMode,
  onToggleAssetStorageMode,
  toastMessage,
}) => {
  return (
    <footer className="flex items-center justify-between h-7 shrink-0 px-3 border-t border-[var(--letra-border)] bg-[var(--letra-chrome-bg)] text-[11px] text-[var(--letra-muted)] select-none">
      {/* Left: Path or status toast + Asset mode toggle */}
      <div className="flex items-center gap-3 min-w-0">
        {toastMessage ? (
          <span className="text-indigo-500 font-medium truncate">{toastMessage}</span>
        ) : (
          <span className="truncate max-w-[340px]" title={filePath || 'Unsaved document'}>
            {filePath || 'Unsaved document'}
          </span>
        )}

        <button
          type="button"
          onClick={onToggleAssetStorageMode}
          title="Click to switch how pasted/imported images are saved"
          className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--letra-hover)] hover:text-[var(--letra-fg)] transition-colors cursor-pointer shrink-0"
        >
          {assetStorageMode === 'local-folder' ? (
            <>
              <FolderArchive className="w-3 h-3 text-indigo-500" />
              <span>Assets: ./assets/</span>
            </>
          ) : (
            <>
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>Assets: Embed Base64</span>
            </>
          )}
        </button>
      </div>

      {/* Right: Metrics & Sync Scroll */}
      <div className="flex items-center gap-3 shrink-0">
        {viewMode === 'split' && (
          <button
            type="button"
            onClick={onToggleSyncScroll}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
              syncScroll
                ? 'text-indigo-500 bg-indigo-500/10'
                : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)]'
            }`}
            title="Synchronize scrolling between raw editor and preview"
          >
            <Link2 className="w-3 h-3" />
            <span>Sync Scroll</span>
          </button>
        )}

        {viewMode !== 'raw' && previewMode === 'page' && (
          <span>
            {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </span>
        )}

        <span>{wordCount.toLocaleString()} words</span>
        <span className="hidden md:inline">{charCount.toLocaleString()} chars</span>
        <span className="hidden sm:inline">{readingTimeMin} min read</span>
      </div>
    </footer>
  );
};
