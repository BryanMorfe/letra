import { contextBridge, ipcRenderer } from 'electron';
import type { LetraBridge, MenuActionEvent, ResolvedTheme } from '../shared/types';

const api: LetraBridge = {
  platform: process.platform,

  getSystemTheme: () => ipcRenderer.invoke('theme:get-system'),

  onSystemThemeChange: (cb: (theme: ResolvedTheme) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: ResolvedTheme) => cb(theme);
    ipcRenderer.on('theme:system-changed', listener);
    return () => ipcRenderer.removeListener('theme:system-changed', listener);
  },

  onMenuAction: (cb: (event: MenuActionEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: MenuActionEvent) => cb(payload);
    ipcRenderer.on('letra:menu-action', listener);
    return () => ipcRenderer.removeListener('letra:menu-action', listener);
  },

  onOpenExternalFile: (cb) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { filePath: string; content: string; title: string }
    ) => cb(payload);
    ipcRenderer.on('letra:open-external-file', listener);
    return () => ipcRenderer.removeListener('letra:open-external-file', listener);
  },

  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  readFile: (filePath) => ipcRenderer.invoke('fs:read-file', filePath),
  saveFile: (params) => ipcRenderer.invoke('fs:save-file', params),
  saveFileAs: (params) => ipcRenderer.invoke('fs:save-file-as', params),

  openFolderDialog: () => ipcRenderer.invoke('dialog:open-folder'),
  readFolderTree: (folderPath) => ipcRenderer.invoke('fs:read-folder-tree', folderPath),
  createFileInFolder: (parentDir, fileName) =>
    ipcRenderer.invoke('fs:create-file', { parentDir, fileName }),
  createFolderInFolder: (parentDir, folderName) =>
    ipcRenderer.invoke('fs:create-folder', { parentDir, folderName }),
  renamePath: (oldPath, newName) => ipcRenderer.invoke('fs:rename-path', { oldPath, newName }),
  deletePath: (targetPath) => ipcRenderer.invoke('fs:delete-path', targetPath),
  revealInFileManager: (targetPath) => ipcRenderer.invoke('shell:reveal', targetPath),

  importAssetsDialog: (params) => ipcRenderer.invoke('assets:import-dialog', params),
  saveAssetFromBytes: (params) => ipcRenderer.invoke('assets:save-bytes', params),

  exportPdf: (req) => ipcRenderer.invoke('export:pdf', req),
  exportHtml: (req) => ipcRenderer.invoke('export:html', req),
  openExternalUrl: (url) => ipcRenderer.invoke('shell:open-external', url),
};

contextBridge.exposeInMainWorld('letra', api);
