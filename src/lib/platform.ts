import type {
  AssetStorageMode,
  ExportHtmlRequest,
  ExportPdfRequest,
  ImportedAssetResult,
  LetraBridge,
  ResolvedTheme,
} from '../../shared/types';

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.letra);
}

export function getPlatform(): string {
  if (window.letra?.platform) return window.letra.platform;
  if (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)) return 'darwin';
  return 'linux';
}

export async function getInitialSystemTheme(): Promise<ResolvedTheme> {
  if (window.letra) {
    return window.letra.getSystemTheme();
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function subscribeSystemTheme(cb: (theme: ResolvedTheme) => void): () => void {
  if (window.letra) {
    return window.letra.onSystemThemeChange(cb);
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (e: MediaQueryListEvent) => cb(e.matches ? 'dark' : 'light');
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}

export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function importAssetFile(params: {
  file: File;
  documentPath: string | null;
  storageMode: AssetStorageMode;
  stagedAssetDir: string | null;
}): Promise<ImportedAssetResult> {
  const base64Data = await readFileAsBase64(params.file);
  const mimeType = params.file.type || 'application/octet-stream';
  const fileName = params.file.name || `pasted-asset-${Date.now()}.png`;

  if (window.letra) {
    return window.letra.saveAssetFromBytes({
      fileName,
      mimeType,
      base64Data,
      documentPath: params.documentPath,
      storageMode: params.storageMode,
      stagedAssetDir: params.stagedAssetDir,
    });
  }

  // Web fallback: embed as data URI directly
  const dataUri = `data:${mimeType};base64,${base64Data}`;
  const isImage = mimeType.startsWith('image/');
  const alt = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
  return {
    markdown: isImage ? `![${alt}](${dataUri})` : `[${fileName}](${dataUri})`,
    relativePath: dataUri,
    fileName,
    mimeType,
    isImage,
    stagedDir: null,
  };
}

export async function triggerImportDialog(params: {
  documentPath: string | null;
  storageMode: AssetStorageMode;
  stagedAssetDir: string | null;
}): Promise<ImportedAssetResult[]> {
  if (window.letra) {
    return window.letra.importAssetsDialog(params);
  }
  // Web fallback using hidden <input type="file">
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*,audio/*,.pdf,.svg';
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      const results: ImportedAssetResult[] = [];
      for (const file of files) {
        results.push(
          await importAssetFile({
            file,
            documentPath: params.documentPath,
            storageMode: 'embed-base64',
            stagedAssetDir: null,
          })
        );
      }
      resolve(results);
    };
    input.click();
  });
}

export async function exportPdfDocument(req: ExportPdfRequest) {
  if (window.letra) {
    return window.letra.exportPdf(req);
  }
  window.print();
  return { canceled: false };
}

export async function exportHtmlDocument(req: ExportHtmlRequest) {
  if (window.letra) {
    return window.letra.exportHtml(req);
  }
  const blob = new Blob(
    [
      `<!doctype html><html><head><meta charset="utf-8"><title>${req.title}</title></head><body>${req.htmlBody}</body></html>`,
    ],
    { type: 'text/html;charset=utf-8' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${req.title.replace(/\.[^/.]+$/, '') || 'document'}.html`;
  a.click();
  URL.revokeObjectURL(url);
  return { canceled: false };
}

export function openExternalLink(url: string) {
  if (window.letra) {
    window.letra.openExternalUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export type { LetraBridge };
