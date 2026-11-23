import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PAGE_SETTINGS } from '../shared/pagePresets';
import type {
  AssetStorageMode,
  DocumentTab,
  FileTreeNode,
  PageSettings,
  PreviewMode,
  ResolvedTheme,
  ThemeMode,
  ViewMode,
} from '../shared/types';
import { MarkdownEditor, type MarkdownEditorHandle } from './components/MarkdownEditor';
import { MarkdownPreview, type MarkdownPreviewHandle } from './components/MarkdownPreview';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { TabBar } from './components/TabBar';
import { TopBar } from './components/TopBar';
import { renderMarkdown } from './lib/markdown';
import { hydrateMermaidInContainer } from './lib/mermaidRenderer';
import {
  exportHtmlDocument,
  exportPdfDocument,
  getInitialSystemTheme,
  getPlatform,
  importAssetFile,
  subscribeSystemTheme,
  triggerImportDialog,
} from './lib/platform';
import { WELCOME_MARKDOWN } from './lib/welcomeDocument';

const STORAGE_KEY = 'letra:preferences:v1';

interface PersistedPreferences {
  themeMode: ThemeMode;
  viewMode: ViewMode;
  previewMode: PreviewMode;
  pageSettings: PageSettings;
  assetStorageMode: AssetStorageMode;
  syncScroll: boolean;
  sidebarVisible: boolean;
  sidebarTab: 'files' | 'outline';
  splitRatio: number;
}

function loadPreferences(): PersistedPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedPreferences>;
      return {
        themeMode: parsed.themeMode || 'system',
        viewMode: parsed.viewMode || 'split',
        previewMode: parsed.previewMode || 'continuous',
        pageSettings: {
          ...DEFAULT_PAGE_SETTINGS,
          ...(parsed.pageSettings || {}),
          marginsMm: {
            ...DEFAULT_PAGE_SETTINGS.marginsMm,
            ...(parsed.pageSettings?.marginsMm || {}),
          },
          header: {
            ...DEFAULT_PAGE_SETTINGS.header,
            ...(parsed.pageSettings?.header || {}),
          },
          footer: {
            ...DEFAULT_PAGE_SETTINGS.footer,
            ...(parsed.pageSettings?.footer || {}),
          },
        },
        assetStorageMode: parsed.assetStorageMode || 'local-folder',
        syncScroll: parsed.syncScroll ?? true,
        sidebarVisible: parsed.sidebarVisible ?? true,
        sidebarTab: parsed.sidebarTab || 'outline',
        splitRatio: parsed.splitRatio ?? 0.5,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return {
    themeMode: 'system',
    viewMode: 'split',
    previewMode: 'continuous',
    pageSettings: DEFAULT_PAGE_SETTINGS,
    assetStorageMode: 'local-folder',
    syncScroll: true,
    sidebarVisible: true,
    sidebarTab: 'outline',
    splitRatio: 0.5,
  };
}

function createTab(partial?: Partial<DocumentTab>): DocumentTab {
  const content = partial?.content ?? '# Untitled\n\n';
  return {
    id: crypto.randomUUID(),
    title: partial?.title ?? 'Untitled.md',
    filePath: partial?.filePath ?? null,
    content,
    savedContent: partial?.savedContent ?? content,
    stagedAssetDir: partial?.stagedAssetDir ?? null,
  };
}

export const App: React.FC = () => {
  const initialPrefs = useMemo(() => loadPreferences(), []);
  const isMac = useMemo(() => getPlatform() === 'darwin', []);

  // Theme state (System default)
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialPrefs.themeMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');
  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  // Layout & View state
  const [viewMode, setViewMode] = useState<ViewMode>(initialPrefs.viewMode);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(initialPrefs.previewMode);
  const [pageSettings, setPageSettings] = useState<PageSettings>(initialPrefs.pageSettings);
  const [assetStorageMode, setAssetStorageMode] = useState<AssetStorageMode>(initialPrefs.assetStorageMode);
  const [syncScroll, setSyncScroll] = useState<boolean>(initialPrefs.syncScroll);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(initialPrefs.sidebarVisible);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'outline'>(initialPrefs.sidebarTab);
  const [sidebarWidth, setSidebarWidth] = useState<number>(248);
  const [splitRatio, setSplitRatio] = useState<number>(initialPrefs.splitRatio);

  // Documents / Multi-tab state
  const [tabs, setTabs] = useState<DocumentTab[]>(() => [
    createTab({
      title: 'Welcome to Letra.md',
      content: WELCOME_MARKDOWN,
      savedContent: WELCOME_MARKDOWN,
    }),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);

  // Workspace File Tree state
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [pageCount, setPageCount] = useState<number>(1);
  const [exporting, setExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const editorRef = useRef<MarkdownEditorHandle>(null);
  const previewRef = useRef<MarkdownPreviewHandle>(null);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // System theme subscription
  useEffect(() => {
    getInitialSystemTheme().then(setSystemTheme);
    return subscribeSystemTheme(setSystemTheme);
  }, []);

  // Apply resolved theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  // Persist user preferences
  useEffect(() => {
    try {
      const payload: PersistedPreferences = {
        themeMode,
        viewMode,
        previewMode,
        pageSettings,
        assetStorageMode,
        syncScroll,
        sidebarVisible,
        sidebarTab,
        splitRatio,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [
    themeMode,
    viewMode,
    previewMode,
    pageSettings,
    assetStorageMode,
    syncScroll,
    sidebarVisible,
    sidebarTab,
    splitRatio,
  ]);

  // Render Markdown synchronously with memoization
  const rendered = useMemo(
    () =>
      renderMarkdown(activeTab.content, {
        documentPath: activeTab.filePath,
        stagedAssetDir: activeTab.stagedAssetDir,
      }),
    [activeTab.content, activeTab.filePath, activeTab.stagedAssetDir]
  );

  // Update active tab content
  const updateActiveContent = useCallback(
    (nextContent: string) => {
      setTabs((prev) =>
        prev.map((tab) => (tab.id === activeTab.id ? { ...tab, content: nextContent } : tab))
      );
    },
    [activeTab.id]
  );

  const handleNewTab = useCallback(() => {
    const newTab = createTab({
      title: `Untitled-${tabs.length + 1}.md`,
      content: `# Untitled ${tabs.length + 1}\n\n`,
      savedContent: `# Untitled ${tabs.length + 1}\n\n`,
    });
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setTimeout(() => editorRef.current?.focus(), 40);
  }, [tabs.length]);

  const handleCloseTab = useCallback(
    (id: string) => {
      const target = tabs.find((t) => t.id === id);
      if (target && target.content !== target.savedContent) {
        const confirmed = window.confirm(
          `"${target.title}" has unsaved changes. Close without saving?`
        );
        if (!confirmed) return;
      }

      if (tabs.length === 1) {
        const fresh = createTab({ title: 'Untitled.md', content: '# Untitled\n\n', savedContent: '# Untitled\n\n' });
        setTabs([fresh]);
        setActiveTabId(fresh.id);
        return;
      }

      const idx = tabs.findIndex((t) => t.id === id);
      const nextTabs = tabs.filter((t) => t.id !== id);
      setTabs(nextTabs);
      if (activeTabId === id) {
        const nextActive = nextTabs[Math.max(0, idx - 1)] || nextTabs[0];
        setActiveTabId(nextActive.id);
      }
    },
    [tabs, activeTabId]
  );

  const openDocumentInTab = useCallback((doc: { filePath: string; content: string; title: string }) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.filePath === doc.filePath);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const next = createTab({
        title: doc.title,
        filePath: doc.filePath,
        content: doc.content,
        savedContent: doc.content,
      });
      setActiveTabId(next.id);
      return [...prev, next];
    });
  }, []);

  const handleOpenFile = useCallback(async () => {
    if (window.letra) {
      const opened = await window.letra.openFileDialog();
      if (opened) {
        openDocumentInTab(opened);
        showToast(`Opened ${opened.title}`);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.txt';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        openDocumentInTab({ filePath: file.name, content: text, title: file.name });
      };
      input.click();
    }
  }, [openDocumentInTab, showToast]);

  const handleSaveFile = useCallback(
    async (forceSaveAs = false) => {
      if (!window.letra) {
        // Web fallback download
        const blob = new Blob([activeTab.content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeTab.title.endsWith('.md') ? activeTab.title : `${activeTab.title}.md`;
        a.click();
        URL.revokeObjectURL(url);
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, savedContent: t.content } : t))
        );
        showToast(`Downloaded ${activeTab.title}`);
        return;
      }

      const res = forceSaveAs
        ? await window.letra.saveFileAs({
            content: activeTab.content,
            defaultTitle: activeTab.title,
            stagedAssetDir: activeTab.stagedAssetDir,
          })
        : await window.letra.saveFile({
            filePath: activeTab.filePath,
            content: activeTab.content,
            defaultTitle: activeTab.title,
            stagedAssetDir: activeTab.stagedAssetDir,
          });

      if (!res.canceled && res.filePath) {
        const finalContent = res.updatedContent ?? activeTab.content;
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  filePath: res.filePath!,
                  title: res.title || t.title,
                  content: finalContent,
                  savedContent: finalContent,
                  stagedAssetDir: null,
                }
              : t
          )
        );
        showToast(`Saved ${res.title || activeTab.title}`);
        if (workspacePath) {
          const tree = await window.letra.readFolderTree(workspacePath);
          setFileTree(tree);
        }
      }
    },
    [activeTab, showToast, workspacePath]
  );

  const handleOpenFolder = useCallback(async () => {
    if (!window.letra) {
      showToast('Workspace folders are available in the desktop app');
      return;
    }
    const res = await window.letra.openFolderDialog();
    if (res) {
      setWorkspacePath(res.folderPath);
      setFileTree(res.tree);
      setSidebarVisible(true);
      setSidebarTab('files');
      showToast('Workspace folder loaded');
    }
  }, [showToast]);

  const handleRefreshFolder = useCallback(async () => {
    if (!window.letra || !workspacePath) return;
    const tree = await window.letra.readFolderTree(workspacePath);
    setFileTree(tree);
  }, [workspacePath]);

  const handleOpenFileFromTree = useCallback(
    async (filePath: string) => {
      if (!window.letra) return;
      try {
        const doc = await window.letra.readFile(filePath);
        openDocumentInTab(doc);
      } catch {
        showToast('Could not read file');
      }
    },
    [openDocumentInTab, showToast]
  );

  const handleCreateFile = useCallback(
    async (parentDir: string, name: string) => {
      if (!window.letra) return;
      const created = await window.letra.createFileInFolder(parentDir, name);
      await handleRefreshFolder();
      await handleOpenFileFromTree(created.filePath);
      showToast(`Created ${created.title}`);
    },
    [handleOpenFileFromTree, handleRefreshFolder, showToast]
  );

  const handleCreateFolder = useCallback(
    async (parentDir: string, name: string) => {
      if (!window.letra) return;
      await window.letra.createFolderInFolder(parentDir, name);
      await handleRefreshFolder();
      showToast(`Created folder ${name}`);
    },
    [handleRefreshFolder, showToast]
  );

  const handleDeletePath = useCallback(
    async (targetPath: string) => {
      if (!window.letra) return;
      const name = targetPath.split(/[\\/]/).pop() || targetPath;
      if (!window.confirm(`Move "${name}" to Trash?`)) return;
      await window.letra.deletePath(targetPath);
      await handleRefreshFolder();
      showToast(`Moved ${name} to Trash`);
    },
    [handleRefreshFolder, showToast]
  );

  // Asset importing (dialog, paste, drag-drop)
  const insertImportedAssets = useCallback(
    (items: Array<{ markdown: string; stagedDir?: string | null }>) => {
      if (items.length === 0) return;
      const snippet = `\n${items.map((i) => i.markdown).join('\n\n')}\n`;
      const nextStaged = items.find((i) => i.stagedDir)?.stagedDir;

      if (nextStaged && !activeTab.stagedAssetDir) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, stagedAssetDir: nextStaged } : t))
        );
      }

      if (editorRef.current) {
        editorRef.current.insertSnippet(snippet);
      } else {
        updateActiveContent(`${activeTab.content}${snippet}`);
      }
      showToast(`Inserted ${items.length} ${items.length === 1 ? 'asset' : 'assets'}`);
    },
    [activeTab.content, activeTab.id, activeTab.stagedAssetDir, showToast, updateActiveContent]
  );

  const handleImportAssetDialog = useCallback(async () => {
    const imported = await triggerImportDialog({
      documentPath: activeTab.filePath,
      storageMode: assetStorageMode,
      stagedAssetDir: activeTab.stagedAssetDir,
    });
    insertImportedAssets(imported);
  }, [activeTab.filePath, activeTab.stagedAssetDir, assetStorageMode, insertImportedAssets]);

  const handleImportDroppedOrPastedFiles = useCallback(
    async (files: File[]) => {
      const results = [];
      let currentStaged = activeTab.stagedAssetDir;
      for (const file of files) {
        const res = await importAssetFile({
          file,
          documentPath: activeTab.filePath,
          storageMode: assetStorageMode,
          stagedAssetDir: currentStaged,
        });
        if (res.stagedDir) currentStaged = res.stagedDir;
        results.push(res);
      }
      insertImportedAssets(results);
    },
    [activeTab.filePath, activeTab.stagedAssetDir, assetStorageMode, insertImportedAssets]
  );

  // Build hydrated HTML with Mermaid SVGs rendered for export (works even in Raw mode!)
  const getExportHtmlBody = useCallback(
    async (targetTheme: ResolvedTheme): Promise<string> => {
      const liveHtml = previewRef.current?.getHydratedHtml();
      if (liveHtml && !liveHtml.includes('letra-mermaid-loading')) {
        return liveHtml;
      }
      const scratch = document.createElement('div');
      scratch.innerHTML = rendered.html;
      await hydrateMermaidInContainer(scratch, targetTheme);
      return scratch.innerHTML;
    },
    [rendered.html]
  );

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const htmlBody = await getExportHtmlBody('light');
      const res = await exportPdfDocument({
        title: rendered.frontmatterTitle || activeTab.title,
        htmlBody,
        theme: 'light',
        pageSettings,
        documentPath: activeTab.filePath,
        stagedAssetDir: activeTab.stagedAssetDir,
        totalPagesEstimate: pageCount,
      });
      if (res.error) {
        showToast(`PDF export failed: ${res.error}`);
      } else if (!res.canceled) {
        showToast('Exported print-ready PDF');
      }
    } finally {
      setExporting(false);
    }
  }, [
    activeTab.filePath,
    activeTab.stagedAssetDir,
    activeTab.title,
    getExportHtmlBody,
    pageCount,
    pageSettings,
    rendered.frontmatterTitle,
    showToast,
  ]);

  const handleExportHtml = useCallback(async () => {
    setExporting(true);
    try {
      const htmlBody = await getExportHtmlBody(resolvedTheme);
      const res = await exportHtmlDocument({
        title: rendered.frontmatterTitle || activeTab.title,
        htmlBody,
        theme: resolvedTheme,
        pageSettings,
        previewMode,
      });
      if (res.error) {
        showToast(`HTML export failed: ${res.error}`);
      } else if (!res.canceled) {
        showToast('Exported standalone HTML');
      }
    } finally {
      setExporting(false);
    }
  }, [
    activeTab.title,
    getExportHtmlBody,
    pageSettings,
    previewMode,
    rendered.frontmatterTitle,
    resolvedTheme,
    showToast,
  ]);

  // Listen to Electron native menu actions & external open-file events
  useEffect(() => {
    if (!window.letra) return;
    const offMenu = window.letra.onMenuAction(({ action }) => {
      switch (action) {
        case 'new-file':
          handleNewTab();
          break;
        case 'open-file':
          handleOpenFile();
          break;
        case 'open-folder':
          handleOpenFolder();
          break;
        case 'save':
          handleSaveFile(false);
          break;
        case 'save-as':
          handleSaveFile(true);
          break;
        case 'close-tab':
          handleCloseTab(activeTab.id);
          break;
        case 'import-asset':
          handleImportAssetDialog();
          break;
        case 'export-pdf':
          handleExportPdf();
          break;
        case 'export-html':
          handleExportHtml();
          break;
        case 'view-raw':
          setViewMode('raw');
          break;
        case 'view-split':
          setViewMode('split');
          break;
        case 'view-preview':
          setViewMode('preview');
          break;
        case 'toggle-page-mode':
          setPreviewMode((m) => (m === 'page' ? 'continuous' : 'page'));
          setViewMode((v) => (v === 'raw' ? 'preview' : v));
          break;
        case 'toggle-sidebar':
          setSidebarVisible((s) => !s);
          break;
        case 'theme-system':
          setThemeMode('system');
          break;
        case 'theme-light':
          setThemeMode('light');
          break;
        case 'theme-dark':
          setThemeMode('dark');
          break;
        case 'find':
          editorRef.current?.openSearch();
          break;
      }
    });

    const offOpen = window.letra.onOpenExternalFile((doc) => {
      openDocumentInTab(doc);
    });

    return () => {
      offMenu();
      offOpen();
    };
  }, [
    activeTab.id,
    handleCloseTab,
    handleExportHtml,
    handleExportPdf,
    handleImportAssetDialog,
    handleNewTab,
    handleOpenFile,
    handleOpenFolder,
    handleSaveFile,
    openDocumentInTab,
  ]);

  // Keyboard shortcuts fallback when running outside Electron menus
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === '1') {
        e.preventDefault();
        setViewMode('raw');
      } else if (e.key === '2') {
        e.preventDefault();
        setViewMode('split');
      } else if (e.key === '3') {
        e.preventDefault();
        setViewMode('preview');
      } else if (e.key === '\\') {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPreviewMode((m) => (m === 'page' ? 'continuous' : 'page'));
        setViewMode((v) => (v === 'raw' ? 'preview' : v));
      } else if (!window.letra && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFile(e.shiftKey);
      } else if (!window.letra && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (e.shiftKey) handleExportHtml();
        else handleExportPdf();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExportHtml, handleExportPdf, handleSaveFile]);

  // Drag resize for split pane
  const startSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = workspaceContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.78, Math.max(0.22, ratio)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag resize for sidebar
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(380, Math.max(190, startW + (ev.clientX - startX)));
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const isDirty = activeTab.content !== activeTab.savedContent;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--letra-chrome-bg)] text-[var(--letra-fg)]">
      {/* Top Window Chrome */}
      <TopBar
        isMac={isMac}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((v) => !v)}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        previewMode={previewMode}
        onTogglePreviewMode={() => setPreviewMode((m) => (m === 'page' ? 'continuous' : 'page'))}
        themeMode={themeMode}
        onChangeThemeMode={setThemeMode}
        isDirty={isDirty}
        onNewFile={handleNewTab}
        onOpenFile={handleOpenFile}
        onSaveFile={() => handleSaveFile(false)}
        onImportAsset={handleImportAssetDialog}
        onExportPdf={handleExportPdf}
        onExportHtml={handleExportHtml}
        exporting={exporting}
      />

      {/* Multi-Tab Document Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTab.id}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {/* Main Content Area: Sidebar + Editor / Preview */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {sidebarVisible && (
          <>
            <div style={{ width: `${sidebarWidth}px` }} className="shrink-0 h-full">
              <Sidebar
                activeTab={sidebarTab}
                onChangeTab={setSidebarTab}
                workspacePath={workspacePath}
                fileTree={fileTree}
                activeFilePath={activeTab.filePath}
                headings={rendered.headings}
                onOpenFolder={handleOpenFolder}
                onRefreshFolder={handleRefreshFolder}
                onOpenFileFromTree={handleOpenFileFromTree}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onDeletePath={handleDeletePath}
                onSelectHeading={(id) => {
                  if (viewMode === 'raw') setViewMode('split');
                  setTimeout(() => previewRef.current?.scrollToHeading(id), 30);
                }}
              />
            </div>
            <div
              onMouseDown={startSidebarResize}
              className="w-1 -ml-0.5 z-10 cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-500/60 transition-colors shrink-0"
              title="Drag to resize sidebar"
            />
          </>
        )}

        {/* Editor & Preview Split Surface */}
        <main ref={workspaceContainerRef} className="flex flex-1 min-w-0 h-full overflow-hidden">
          {viewMode !== 'preview' && (
            <div
              style={viewMode === 'split' ? { width: `${splitRatio * 100}%` } : { width: '100%' }}
              className="h-full min-w-0 overflow-hidden"
            >
              <MarkdownEditor
                ref={editorRef}
                value={activeTab.content}
                onChange={updateActiveContent}
                theme={resolvedTheme}
                fontSizePx={14}
                showLineNumbers={true}
                wordWrap={true}
                onImportFiles={handleImportDroppedOrPastedFiles}
                onTriggerImportDialog={handleImportAssetDialog}
                onScrollRatio={(ratio) => {
                  if (syncScroll && viewMode === 'split') {
                    previewRef.current?.scrollToRatio(ratio);
                  }
                }}
              />
            </div>
          )}

          {viewMode === 'split' && (
            <div
              onMouseDown={startSplitResize}
              onDoubleClick={() => setSplitRatio(0.5)}
              title="Drag to resize · Double-click to reset 50/50"
              className="w-[5px] bg-[var(--letra-border)]/70 hover:bg-indigo-500/50 active:bg-indigo-500 cursor-col-resize transition-colors shrink-0 relative z-10"
            />
          )}

          {viewMode !== 'raw' && (
            <div
              style={
                viewMode === 'split' ? { width: `${(1 - splitRatio) * 100}%` } : { width: '100%' }
              }
              className="h-full min-w-0 overflow-hidden"
            >
              <MarkdownPreview
                ref={previewRef}
                html={rendered.html}
                documentTitle={rendered.frontmatterTitle || activeTab.title}
                theme={resolvedTheme}
                previewMode={previewMode}
                pageSettings={pageSettings}
                onChangePageSettings={setPageSettings}
                onPageCountChange={setPageCount}
                onScrollRatio={(ratio) => {
                  if (syncScroll && viewMode === 'split') {
                    editorRef.current?.scrollToRatio(ratio);
                  }
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        filePath={activeTab.filePath}
        wordCount={rendered.wordCount}
        charCount={rendered.charCount}
        readingTimeMin={rendered.readingTimeMin}
        pageCount={pageCount}
        previewMode={previewMode}
        viewMode={viewMode}
        syncScroll={syncScroll}
        onToggleSyncScroll={() => setSyncScroll((v) => !v)}
        assetStorageMode={assetStorageMode}
        onToggleAssetStorageMode={() => {
          const next: AssetStorageMode =
            assetStorageMode === 'local-folder' ? 'embed-base64' : 'local-folder';
          setAssetStorageMode(next);
          showToast(
            next === 'local-folder'
              ? 'Assets will be copied into ./assets/ next to your document'
              : 'Assets will be embedded as base64 inside the Markdown'
          );
        }}
        toastMessage={toastMessage}
      />
    </div>
  );
};
