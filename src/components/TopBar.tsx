import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Code2,
  Columns2,
  Download,
  Eye,
  FileCode2,
  FileDown,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  Monitor,
  Moon,
  PanelLeft,
  Save,
  Sun,
} from 'lucide-react';
import type { PreviewMode, ThemeMode, ViewMode } from '../../shared/types';

interface TopBarProps {
  isMac: boolean;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  previewMode: PreviewMode;
  onTogglePreviewMode: () => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (mode: ThemeMode) => void;
  isDirty: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onImportAsset: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  exporting: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  isMac,
  sidebarVisible,
  onToggleSidebar,
  viewMode,
  onChangeViewMode,
  previewMode,
  onTogglePreviewMode,
  themeMode,
  onChangeThemeMode,
  isDirty,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onImportAsset,
  onExportPdf,
  onExportHtml,
  exporting,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const ThemeIcon = themeMode === 'dark' ? Moon : themeMode === 'light' ? Sun : Monitor;

  return (
    <header
      className={`letra-titlebar grid grid-cols-[1fr_auto_1fr] items-center h-11 shrink-0 border-b border-[var(--letra-border)] bg-[var(--letra-chrome-bg)] select-none pr-3 ${
        isMac ? 'pl-[78px]' : 'pl-3'
      }`}
    >
      {/* Left Cluster: Sidebar & File Actions */}
      <div className="flex items-center gap-1 letra-no-drag">
        <button
          type="button"
          title="Toggle Sidebar (⌘/Ctrl + \)"
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            sidebarVisible
              ? 'bg-[var(--letra-hover)] text-[var(--letra-fg)]'
              : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)]'
          }`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="w-px h-4 mx-1 bg-[var(--letra-border)]" />

        <button
          type="button"
          title="New Document (⌘/Ctrl + N)"
          onClick={onNewFile}
          className="p-1.5 rounded-lg text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] transition-colors cursor-pointer"
        >
          <FilePlus2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="Open File (⌘/Ctrl + O)"
          onClick={onOpenFile}
          className="p-1.5 rounded-lg text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] transition-colors cursor-pointer"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="Save (⌘/Ctrl + S)"
          onClick={onSaveFile}
          className={`relative p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDirty
              ? 'text-indigo-500 hover:bg-indigo-500/10'
              : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)]'
          }`}
        >
          <Save className="w-4 h-4" />
          {isDirty && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
          )}
        </button>
      </div>

      {/* Center Cluster: View Mode Segmented Switcher */}
      <div className="flex items-center justify-center letra-no-drag">
        <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--letra-segment-bg)] border border-[var(--letra-border)]">
          {(
            [
              ['raw', 'Raw', <Code2 key="r" className="w-3.5 h-3.5" />],
              ['split', 'Split', <Columns2 key="s" className="w-3.5 h-3.5" />],
              ['preview', 'Preview', <Eye key="p" className="w-3.5 h-3.5" />],
            ] as Array<[ViewMode, string, React.ReactNode]>
          ).map(([mode, label, icon]) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeViewMode(mode)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--letra-elevated)] text-[var(--letra-fg)] shadow-xs'
                    : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)]'
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Cluster: Page Mode, Import Asset, Export, Theme */}
      <div className="flex items-center justify-end gap-1.5 letra-no-drag">
        {viewMode !== 'raw' && (
          <button
            type="button"
            title="Toggle Print-Ready Page Mode (⌘/Ctrl + Shift + P)"
            onClick={onTogglePreviewMode}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              previewMode === 'page'
                ? 'border-indigo-500/50 bg-indigo-500/12 text-indigo-500'
                : 'border-[var(--letra-border)] text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Page Mode</span>
          </button>
        )}

        <button
          type="button"
          title="Import Image or Asset (⌘/Ctrl + Shift + I)"
          onClick={onImportAsset}
          className="p-1.5 rounded-lg text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] transition-colors cursor-pointer"
        >
          <ImagePlus className="w-4 h-4" />
        </button>

        {/* Export Dropdown */}
        <div ref={exportRef} className="relative">
          <button
            type="button"
            disabled={exporting}
            title="Export Document"
            onClick={() => setExportMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{exporting ? 'Exporting…' : 'Export'}</span>
          </button>

          {exportMenuOpen && (
            <div className="absolute right-0 top-9 z-50 w-48 rounded-xl border border-[var(--letra-border)] bg-[var(--letra-elevated)] shadow-xl p-1">
              <button
                type="button"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportPdf();
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-left text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-indigo-500" />
                <div>
                  <div className="font-medium">Export as PDF…</div>
                  <div className="text-[10px] text-[var(--letra-muted)]">Honors Page Mode layout</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportHtml();
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs text-left text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5 text-emerald-500" />
                <div>
                  <div className="font-medium">Export as HTML…</div>
                  <div className="text-[10px] text-[var(--letra-muted)]">Self-contained document</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <div ref={themeRef} className="relative">
          <button
            type="button"
            title={`Theme: ${themeMode}`}
            onClick={() => setThemeMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] transition-colors cursor-pointer"
          >
            <ThemeIcon className="w-4 h-4" />
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 top-9 z-50 w-36 rounded-xl border border-[var(--letra-border)] bg-[var(--letra-elevated)] shadow-xl p-1">
              {(
                [
                  ['system', 'System', <Monitor key="sys" className="w-3.5 h-3.5" />],
                  ['light', 'Light', <Sun key="lt" className="w-3.5 h-3.5" />],
                  ['dark', 'Dark', <Moon key="dk" className="w-3.5 h-3.5" />],
                ] as Array<[ThemeMode, string, React.ReactNode]>
              ).map(([mode, label, icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    onChangeThemeMode(mode);
                    setThemeMenuOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                    themeMode === mode
                      ? 'bg-indigo-500/12 text-indigo-500 font-medium'
                      : 'text-[var(--letra-fg)] hover:bg-[var(--letra-hover)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {icon}
                    {label}
                  </span>
                  {themeMode === mode && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
