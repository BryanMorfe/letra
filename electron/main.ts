import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  shell,
} from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  AssetStorageMode,
  DocumentFormat,
  ExportHtmlRequest,
  ExportPdfRequest,
  FileTreeNode,
  ImportedAssetResult,
  MenuActionEvent,
  OpenedDocumentPayload,
  ResolvedTheme,
  SaveDocumentResult,
} from '../shared/types';
import { isLetraArchivePath } from '../shared/types';
import { exportDocumentToHtml, exportDocumentToPdf } from './exportService';
import {
  cleanupAllArchiveWorkDirs,
  readLetraArchive,
  releaseArchiveWorkDir,
  writeLetraArchive,
} from './letraArchive';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'letra-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let pendingOpenFilePath: string | null = null;

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.ogg']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.DS_Store', 'dist', 'dist-electron', '.next']);

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function sanitizeAssetFilename(name: string): string {
  const ext = path.extname(name);
  const base = path
    .basename(name, ext)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
  return `${base}${ext.toLowerCase()}`;
}

function uniqueFilePath(dir: string, desiredName: string): { fullPath: string; finalName: string } {
  const ext = path.extname(desiredName);
  const base = path.basename(desiredName, ext);
  let candidate = desiredName;
  let counter = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter += 1;
  }
  return { fullPath: path.join(dir, candidate), finalName: candidate };
}

function buildAssetMarkdown(fileName: string, refPath: string, mimeType: string): { markdown: string; isImage: boolean } {
  const ext = path.extname(fileName).toLowerCase();
  const alt = path.basename(fileName, ext).replace(/[-_]+/g, ' ');
  if (mimeType.startsWith('image/') || IMAGE_EXTS.has(ext)) {
    return { markdown: `![${alt}](${refPath})`, isImage: true };
  }
  if (mimeType.startsWith('video/') || VIDEO_EXTS.has(ext)) {
    return {
      markdown: `<video controls playsinline style="max-width:100%;border-radius:8px;" src="${refPath}"></video>`,
      isImage: false,
    };
  }
  if (mimeType.startsWith('audio/') || AUDIO_EXTS.has(ext)) {
    return {
      markdown: `<audio controls src="${refPath}"></audio>`,
      isImage: false,
    };
  }
  return { markdown: `[${fileName}](${refPath})`, isImage: false };
}

function getOrCreateStagedDir(existing: string | null): string {
  if (existing && fs.existsSync(existing)) return existing;
  const dir = path.join(os.tmpdir(), 'letra-staged', crypto.randomUUID());
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  return dir;
}

function migrateStagedAssets(stagedAssetDir: string | null, savedDocPath: string, content: string): string {
  if (!stagedAssetDir) return content;
  const stagedAssetsFolder = path.join(stagedAssetDir, 'assets');
  if (!fs.existsSync(stagedAssetsFolder)) return content;

  const targetAssetsFolder = path.join(path.dirname(savedDocPath), 'assets');
  const files = fs.readdirSync(stagedAssetsFolder);
  if (files.length === 0) return content;

  fs.mkdirSync(targetAssetsFolder, { recursive: true });
  let updatedContent = content;

  for (const file of files) {
    const oldRef = `./assets/${file}`;
    if (!updatedContent.includes(oldRef) && !updatedContent.includes(`assets/${file}`)) continue;

    const src = path.join(stagedAssetsFolder, file);
    const { fullPath, finalName } = uniqueFilePath(targetAssetsFolder, file);
    fs.copyFileSync(src, fullPath);
    if (finalName !== file) {
      updatedContent = updatedContent.split(`./assets/${file}`).join(`./assets/${finalName}`);
      updatedContent = updatedContent.split(`(assets/${file})`).join(`(./assets/${finalName})`);
    }
  }
  return updatedContent;
}

function readDirectoryTree(dirPath: string, depth = 0): FileTreeNode[] {
  if (depth > 5) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileTreeNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.assets') continue;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children: readDirectoryTree(fullPath, depth + 1),
      });
    } else {
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: false,
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  return nodes;
}

function sendMenuAction(action: MenuActionEvent['action']) {
  mainWindow?.webContents.send('letra:menu-action', { action });
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Letra',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Document', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-file') },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open-file') },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendMenuAction('open-folder') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('save-as') },
        { label: 'Save as .letra Package…', accelerator: 'CmdOrCtrl+Alt+S', click: () => sendMenuAction('save-as-letra') },
        { type: 'separator' },
        { label: 'Import Image or Asset…', accelerator: 'CmdOrCtrl+Shift+I', click: () => sendMenuAction('import-asset') },
        { type: 'separator' },
        { label: 'Export as PDF…', accelerator: 'CmdOrCtrl+E', click: () => sendMenuAction('export-pdf') },
        { label: 'Export as HTML…', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendMenuAction('export-html') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => sendMenuAction('close-tab') },
        ...(!isMac ? [{ type: 'separator' as const }, { role: 'quit' as const }] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Document', accelerator: 'CmdOrCtrl+F', click: () => sendMenuAction('find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Raw Markdown', accelerator: 'CmdOrCtrl+1', click: () => sendMenuAction('view-raw') },
        { label: 'Split View', accelerator: 'CmdOrCtrl+2', click: () => sendMenuAction('view-split') },
        { label: 'Rendered Preview', accelerator: 'CmdOrCtrl+3', click: () => sendMenuAction('view-preview') },
        { type: 'separator' },
        { label: 'Preview Settings', accelerator: 'CmdOrCtrl+Shift+P', click: () => sendMenuAction('toggle-preview-settings') },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => sendMenuAction('toggle-sidebar') },
        { type: 'separator' },
        {
          label: 'Appearance',
          submenu: [
            { label: 'System Default', click: () => sendMenuAction('theme-system') },
            { label: 'Light Mode', click: () => sendMenuAction('theme-light') },
            { label: 'Dark Mode', click: () => sendMenuAction('theme-dark') },
          ],
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function openDocumentFromPath(filePath: string): Promise<OpenedDocumentPayload> {
  if (isLetraArchivePath(filePath)) {
    return readLetraArchive(filePath);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return { filePath, content, title: path.basename(filePath), stagedAssetDir: null };
}

function buildSaveDialogOptions(params: {
  title: string;
  defaultTitle?: string;
  preferredFormat?: DocumentFormat;
}): Electron.SaveDialogOptions {
  const baseTitle = (params.defaultTitle || 'Untitled').replace(/\.(md|markdown|txt|letra)$/i, '') || 'Untitled';
  const preferLetra = params.preferredFormat === 'letra';
  const defaultPath = preferLetra ? `${baseTitle}.letra` : `${baseTitle}.md`;
  const filters: Electron.FileFilter[] = preferLetra
    ? [
        { name: 'Letra Package (.letra)', extensions: ['letra'] },
        { name: 'Markdown Document (.md)', extensions: ['md', 'markdown', 'txt'] },
      ]
    : [
        { name: 'Markdown Document (.md)', extensions: ['md', 'markdown', 'txt'] },
        { name: 'Letra Package (.letra)', extensions: ['letra'] },
      ];
  return {
    title: params.title,
    defaultPath,
    filters,
  };
}

async function saveDocumentToPath(params: {
  targetPath: string;
  content: string;
  stagedAssetDir: string | null;
  sourceMdPath?: string | null;
}): Promise<SaveDocumentResult> {
  if (isLetraArchivePath(params.targetPath)) {
    const saved = await writeLetraArchive({
      targetPath: params.targetPath,
      content: params.content,
      stagedAssetDir: params.stagedAssetDir,
      sourceMdPath: params.sourceMdPath,
    });
    return {
      canceled: false,
      filePath: saved.filePath,
      title: saved.title,
      updatedContent: saved.updatedContent,
      stagedAssetDir: saved.stagedAssetDir,
    };
  }

  const updatedContent = migrateStagedAssets(
    params.stagedAssetDir,
    params.targetPath,
    params.content
  );
  fs.writeFileSync(params.targetPath, updatedContent, 'utf8');
  if (params.stagedAssetDir) {
    releaseArchiveWorkDir(params.stagedAssetDir);
  }
  return {
    canceled: false,
    filePath: params.targetPath,
    title: path.basename(params.targetPath),
    updatedContent,
    stagedAssetDir: null,
  };
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  const isDark = nativeTheme.shouldUseDarkColors;

  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 840,
    minHeight: 560,
    title: 'Letra',
    backgroundColor: isDark ? '#111318' : '#f8f9fb',
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 16, y: 14 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', async () => {
    if (pendingOpenFilePath && fs.existsSync(pendingOpenFilePath)) {
      try {
        const doc = await openDocumentFromPath(pendingOpenFilePath);
        mainWindow?.webContents.send('letra:open-external-file', doc);
      } catch {
        // ignore unreadable startup file
      }
      pendingOpenFilePath = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerProtocol() {
  protocol.handle('letra-asset', async (request) => {
    try {
      const url = new URL(request.url);
      const rawPath = url.searchParams.get('path') || '';
      const baseDir = url.searchParams.get('base') || '';
      if (!rawPath || rawPath.includes('\0')) {
        return new Response('Invalid asset path', { status: 400 });
      }

      const decodedPath = decodeURIComponent(rawPath);
      const resolved = path.isAbsolute(decodedPath)
        ? decodedPath
        : baseDir
          ? path.resolve(baseDir, decodedPath)
          : path.resolve(decodedPath);

      if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        return new Response('Asset not found', { status: 404 });
      }

      const fileUrl = pathToFileURL(resolved).href;
      return net.fetch(fileUrl);
    } catch {
      return new Response('Failed to load asset', { status: 500 });
    }
  });
}

function registerIpc() {
  ipcMain.handle('theme:get-system', (): ResolvedTheme => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  nativeTheme.on('updated', () => {
    const resolved: ResolvedTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    mainWindow?.webContents.send('theme:system-changed', resolved);
  });

  ipcMain.handle('dialog:open-file', async (): Promise<OpenedDocumentPayload | null> => {
    const opts: Electron.OpenDialogOptions = {
      title: 'Open Document',
      properties: ['openFile'],
      filters: [
        { name: 'Letra & Markdown', extensions: ['letra', 'md', 'markdown', 'mdx', 'txt'] },
        { name: 'Letra Package (.letra)', extensions: ['letra'] },
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdx', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
    const res = mainWindow
      ? await dialog.showOpenDialog(mainWindow, opts)
      : await dialog.showOpenDialog(opts);
    if (res.canceled || res.filePaths.length === 0) return null;
    return openDocumentFromPath(res.filePaths[0]);
  });

  ipcMain.handle('fs:read-file', async (_evt, filePath: string): Promise<OpenedDocumentPayload> => {
    return openDocumentFromPath(filePath);
  });

  ipcMain.handle(
    'fs:save-file',
    async (
      _evt,
      params: {
        filePath: string | null;
        content: string;
        defaultTitle?: string;
        stagedAssetDir?: string | null;
        preferredFormat?: DocumentFormat;
      }
    ): Promise<SaveDocumentResult> => {
      if (!params.filePath) {
        const opts = buildSaveDialogOptions({
          title: 'Save Document',
          defaultTitle: params.defaultTitle,
          preferredFormat: params.preferredFormat,
        });
        const res = mainWindow
          ? await dialog.showSaveDialog(mainWindow, opts)
          : await dialog.showSaveDialog(opts);
        if (res.canceled || !res.filePath) return { canceled: true };

        return saveDocumentToPath({
          targetPath: res.filePath,
          content: params.content,
          stagedAssetDir: params.stagedAssetDir ?? null,
        });
      }

      return saveDocumentToPath({
        targetPath: params.filePath,
        content: params.content,
        stagedAssetDir: params.stagedAssetDir ?? null,
        sourceMdPath: params.filePath,
      });
    }
  );

  ipcMain.handle(
    'fs:save-file-as',
    async (
      _evt,
      params: {
        content: string;
        defaultTitle?: string;
        stagedAssetDir?: string | null;
        previousFilePath?: string | null;
        preferredFormat?: DocumentFormat;
      }
    ): Promise<SaveDocumentResult> => {
      const opts = buildSaveDialogOptions({
        title: params.preferredFormat === 'letra' ? 'Save as .letra Package' : 'Save Document As',
        defaultTitle: params.defaultTitle,
        preferredFormat: params.preferredFormat,
      });
      const res = mainWindow
        ? await dialog.showSaveDialog(mainWindow, opts)
        : await dialog.showSaveDialog(opts);
      if (res.canceled || !res.filePath) return { canceled: true };

      return saveDocumentToPath({
        targetPath: res.filePath,
        content: params.content,
        stagedAssetDir: params.stagedAssetDir ?? null,
        sourceMdPath: params.previousFilePath ?? null,
      });
    }
  );

  ipcMain.handle('fs:release-archive-session', async (_evt, stagedAssetDir: string) => {
    releaseArchiveWorkDir(stagedAssetDir);
  });

  ipcMain.handle('dialog:open-folder', async () => {
    const opts: Electron.OpenDialogOptions = {
      title: 'Open Workspace Folder',
      properties: ['openDirectory'],
    };
    const res = mainWindow
      ? await dialog.showOpenDialog(mainWindow, opts)
      : await dialog.showOpenDialog(opts);
    if (res.canceled || res.filePaths.length === 0) return null;
    const folderPath = res.filePaths[0];
    return { folderPath, tree: readDirectoryTree(folderPath) };
  });

  ipcMain.handle('fs:read-folder-tree', async (_evt, folderPath: string) => {
    return readDirectoryTree(folderPath);
  });

  ipcMain.handle('fs:create-file', async (_evt, params: { parentDir: string; fileName: string }) => {
    const trimmed = params.fileName.trim();
    const safeName = /\.(md|markdown|txt|letra)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
    const filePath = path.join(params.parentDir, safeName);
    if (!fs.existsSync(filePath)) {
      const heading = path.basename(safeName, path.extname(safeName));
      if (isLetraArchivePath(filePath)) {
        const res = await writeLetraArchive({
          targetPath: filePath,
          content: `# ${heading}\n\n`,
          stagedAssetDir: null,
        });
        releaseArchiveWorkDir(res.stagedAssetDir);
      } else {
        fs.writeFileSync(filePath, `# ${heading}\n\n`, 'utf8');
      }
    }
    return { filePath, title: path.basename(filePath) };
  });

  ipcMain.handle('fs:create-folder', async (_evt, params: { parentDir: string; folderName: string }) => {
    const folderPath = path.join(params.parentDir, params.folderName.trim());
    fs.mkdirSync(folderPath, { recursive: true });
    return { folderPath };
  });

  ipcMain.handle('fs:rename-path', async (_evt, params: { oldPath: string; newName: string }) => {
    const newPath = path.join(path.dirname(params.oldPath), params.newName.trim());
    fs.renameSync(params.oldPath, newPath);
    return { newPath };
  });

  ipcMain.handle('fs:delete-path', async (_evt, targetPath: string) => {
    await shell.trashItem(targetPath);
    return { ok: true };
  });

  ipcMain.handle('shell:reveal', async (_evt, targetPath: string) => {
    shell.showItemInFolder(targetPath);
  });

  ipcMain.handle(
    'assets:import-dialog',
    async (
      _evt,
      params: { documentPath: string | null; storageMode: AssetStorageMode; stagedAssetDir: string | null }
    ): Promise<ImportedAssetResult[]> => {
      const opts: Electron.OpenDialogOptions = {
        title: 'Import Images or Assets',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Media & Images',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'mp4', 'webm', 'mp3', 'wav', 'pdf'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      };
      const res = mainWindow
        ? await dialog.showOpenDialog(mainWindow, opts)
        : await dialog.showOpenDialog(opts);
      if (res.canceled || res.filePaths.length === 0) return [];

      const results: ImportedAssetResult[] = [];
      let currentStaged = params.stagedAssetDir;

      for (const srcPath of res.filePaths) {
        const mimeType = guessMimeType(srcPath);
        const origName = path.basename(srcPath);
        const buffer = fs.readFileSync(srcPath);

        if (params.storageMode === 'embed-base64') {
          const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
          const { markdown, isImage } = buildAssetMarkdown(origName, dataUri, mimeType);
          results.push({
            markdown,
            relativePath: dataUri,
            fileName: origName,
            mimeType,
            isImage,
            stagedDir: currentStaged,
          });
        } else {
          const isArchive = isLetraArchivePath(params.documentPath);
          const baseDir =
            params.documentPath && !isArchive
              ? path.dirname(params.documentPath)
              : (currentStaged = getOrCreateStagedDir(currentStaged));
          const assetsDir = path.join(baseDir, 'assets');
          fs.mkdirSync(assetsDir, { recursive: true });
          const cleanName = sanitizeAssetFilename(origName);
          const { fullPath, finalName } = uniqueFilePath(assetsDir, cleanName);
          fs.copyFileSync(srcPath, fullPath);
          const relPath = `./assets/${finalName}`;
          const { markdown, isImage } = buildAssetMarkdown(finalName, relPath, mimeType);
          results.push({
            markdown,
            relativePath: relPath,
            fileName: finalName,
            mimeType,
            isImage,
            stagedDir: params.documentPath && !isArchive ? null : currentStaged,
          });
        }
      }
      return results;
    }
  );

  ipcMain.handle(
    'assets:save-bytes',
    async (
      _evt,
      params: {
        fileName: string;
        mimeType: string;
        base64Data: string;
        documentPath: string | null;
        storageMode: AssetStorageMode;
        stagedAssetDir: string | null;
      }
    ): Promise<ImportedAssetResult> => {
      const mimeType = params.mimeType || guessMimeType(params.fileName);
      if (params.storageMode === 'embed-base64') {
        const dataUri = `data:${mimeType};base64,${params.base64Data}`;
        const { markdown, isImage } = buildAssetMarkdown(params.fileName, dataUri, mimeType);
        return {
          markdown,
          relativePath: dataUri,
          fileName: params.fileName,
          mimeType,
          isImage,
          stagedDir: params.stagedAssetDir,
        };
      }

      let currentStaged = params.stagedAssetDir;
      const isArchive = isLetraArchivePath(params.documentPath);
      const baseDir =
        params.documentPath && !isArchive
          ? path.dirname(params.documentPath)
          : (currentStaged = getOrCreateStagedDir(currentStaged));
      const assetsDir = path.join(baseDir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });

      const cleanName = sanitizeAssetFilename(params.fileName);
      const { fullPath, finalName } = uniqueFilePath(assetsDir, cleanName);
      fs.writeFileSync(fullPath, Buffer.from(params.base64Data, 'base64'));
      const relPath = `./assets/${finalName}`;
      const { markdown, isImage } = buildAssetMarkdown(finalName, relPath, mimeType);
      return {
        markdown,
        relativePath: relPath,
        fileName: finalName,
        mimeType,
        isImage,
        stagedDir: params.documentPath && !isArchive ? null : currentStaged,
      };
    }
  );

  ipcMain.handle('export:pdf', async (_evt, req: ExportPdfRequest) => {
    return exportDocumentToPdf(mainWindow, req);
  });

  ipcMain.handle('export:html', async (_evt, req: ExportHtmlRequest) => {
    return exportDocumentToHtml(mainWindow, req);
  });

  ipcMain.handle('shell:open-external', async (_evt, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      await shell.openExternal(url);
    }
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (fs.existsSync(filePath)) {
      openDocumentFromPath(filePath)
        .then((doc) => {
          mainWindow?.webContents.send('letra:open-external-file', doc);
        })
        .catch(() => {
          // ignore open errors
        });
    }
  } else {
    pendingOpenFilePath = filePath;
  }
});

// Check CLI args for opening a file on Linux / macOS
const cliFileArg = process.argv
  .slice(1)
  .find((arg) => !arg.startsWith('-') && /\.(letra|md|markdown|txt)$/i.test(arg));
if (cliFileArg && fs.existsSync(cliFileArg)) {
  pendingOpenFilePath = path.resolve(cliFileArg);
}

app.whenReady().then(() => {
  registerProtocol();
  registerIpc();
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  cleanupAllArchiveWorkDirs();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
