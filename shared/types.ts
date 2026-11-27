export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type ViewMode = 'raw' | 'split' | 'preview';
export type CanvasMode = 'open' | 'page';
export type DocumentFormat = 'md' | 'letra';
export type PagePresetId = 'letter' | 'legal' | 'a4' | 'a5' | 'b5' | 'executive' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';
export type LengthUnit = 'mm' | 'in';
export type AssetStorageMode = 'local-folder' | 'embed-base64';
export type TypographyStyle = 'serif' | 'sans';

export interface PageMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
  linked: boolean;
}

export interface HeaderFooterSlots {
  left: string;
  center: string;
  right: string;
}

export interface PageSettings {
  preset: PagePresetId;
  orientation: PageOrientation;
  unit: LengthUnit;
  customWidthMm: number;
  customHeightMm: number;
  marginsMm: PageMarginsMm;
  showHeader: boolean;
  showFooter: boolean;
  header: HeaderFooterSlots;
  footer: HeaderFooterSlots;
  differentFirstPage: boolean;
  zoom: number | 'fit-width';
  typography: TypographyStyle;
  headingDividers: boolean;
  fontSizePx: number;
}

export interface EditorSettings {
  theme: ThemeMode;
  assetStorageMode: AssetStorageMode;
  syncScroll: boolean;
  showLineNumbers: boolean;
  wordWrap: boolean;
  editorFontSizePx: number;
  sidebarVisible: boolean;
  sidebarTab: 'files' | 'outline';
  sidebarWidth: number;
  splitRatio: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

export interface DocumentTab {
  id: string;
  title: string;
  filePath: string | null;
  content: string;
  savedContent: string;
  stagedAssetDir: string | null;
}

export interface OpenedDocumentPayload {
  filePath: string;
  content: string;
  title: string;
  stagedAssetDir?: string | null;
}

export interface SaveDocumentResult {
  canceled: boolean;
  filePath?: string;
  title?: string;
  updatedContent?: string;
  stagedAssetDir?: string | null;
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export interface ImportedAssetResult {
  markdown: string;
  relativePath: string;
  fileName: string;
  mimeType: string;
  isImage: boolean;
  stagedDir?: string | null;
}

export interface ExportPdfRequest {
  title: string;
  htmlBody: string;
  theme: ResolvedTheme;
  pageSettings: PageSettings;
  documentPath: string | null;
  stagedAssetDir: string | null;
  totalPagesEstimate?: number;
}

export interface ExportHtmlRequest {
  title: string;
  htmlBody: string;
  theme: ResolvedTheme;
  pageSettings: PageSettings;
  canvasMode: CanvasMode;
}

export interface MenuActionEvent {
  action:
    | 'new-file'
    | 'open-file'
    | 'open-folder'
    | 'save'
    | 'save-as'
    | 'save-as-letra'
    | 'close-tab'
    | 'export-pdf'
    | 'export-html'
    | 'import-asset'
    | 'view-raw'
    | 'view-split'
    | 'view-preview'
    | 'toggle-page-mode'
    | 'toggle-preview-settings'
    | 'toggle-sidebar'
    | 'theme-system'
    | 'theme-light'
    | 'theme-dark'
    | 'find';
}

export interface LetraBridge {
  platform: string;
  getSystemTheme: () => Promise<ResolvedTheme>;
  onSystemThemeChange: (cb: (theme: ResolvedTheme) => void) => () => void;
  onMenuAction: (cb: (event: MenuActionEvent) => void) => () => void;
  onOpenExternalFile: (cb: (file: OpenedDocumentPayload) => void) => () => void;

  openFileDialog: () => Promise<OpenedDocumentPayload | null>;
  readFile: (filePath: string) => Promise<OpenedDocumentPayload>;
  saveFile: (params: {
    filePath: string | null;
    content: string;
    defaultTitle?: string;
    stagedAssetDir?: string | null;
    preferredFormat?: DocumentFormat;
  }) => Promise<SaveDocumentResult>;
  saveFileAs: (params: {
    content: string;
    defaultTitle?: string;
    stagedAssetDir?: string | null;
    previousFilePath?: string | null;
    preferredFormat?: DocumentFormat;
  }) => Promise<SaveDocumentResult>;
  releaseArchiveSession: (stagedAssetDir: string) => Promise<void>;

  openFolderDialog: () => Promise<{ folderPath: string; tree: FileTreeNode[] } | null>;
  readFolderTree: (folderPath: string) => Promise<FileTreeNode[]>;
  createFileInFolder: (parentDir: string, fileName: string) => Promise<{ filePath: string; title: string }>;
  createFolderInFolder: (parentDir: string, folderName: string) => Promise<{ folderPath: string }>;
  renamePath: (oldPath: string, newName: string) => Promise<{ newPath: string }>;
  deletePath: (targetPath: string) => Promise<{ ok: boolean }>;
  revealInFileManager: (targetPath: string) => Promise<void>;

  importAssetsDialog: (params: {
    documentPath: string | null;
    storageMode: AssetStorageMode;
    stagedAssetDir: string | null;
  }) => Promise<ImportedAssetResult[]>;
  saveAssetFromBytes: (params: {
    fileName: string;
    mimeType: string;
    base64Data: string;
    documentPath: string | null;
    storageMode: AssetStorageMode;
    stagedAssetDir: string | null;
  }) => Promise<ImportedAssetResult>;

  exportPdf: (req: ExportPdfRequest) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  exportHtml: (req: ExportHtmlRequest) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  openExternalUrl: (url: string) => Promise<void>;
}

export function isLetraArchivePath(filePath: string | null | undefined): boolean {
  return Boolean(filePath && filePath.toLowerCase().endsWith('.letra'));
}

declare global {
  interface Window {
    letra?: LetraBridge;
  }
}
