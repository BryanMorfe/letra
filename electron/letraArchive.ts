import JSZip from 'jszip';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface LetraManifest {
  format: 'letra';
  version: 1;
  entry: string;
  title: string;
  updatedAt: string;
}

const BUNDLES_ROOT = path.join(os.tmpdir(), 'letra-bundles');
const STAGED_ROOT = path.join(os.tmpdir(), 'letra-staged');
const managedWorkDirs = new Set<string>();

export function createManagedBundleWorkDir(): string {
  const dir = path.join(BUNDLES_ROOT, crypto.randomUUID());
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  managedWorkDirs.add(dir);
  return dir;
}

export function isManagedWorkDir(dirPath: string | null | undefined): boolean {
  if (!dirPath) return false;
  const resolved = path.resolve(dirPath);
  return (
    resolved.startsWith(path.resolve(BUNDLES_ROOT) + path.sep) ||
    resolved.startsWith(path.resolve(STAGED_ROOT) + path.sep)
  );
}

export function releaseArchiveWorkDir(dirPath: string | null | undefined): void {
  if (!dirPath || !isManagedWorkDir(dirPath)) return;
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
  managedWorkDirs.delete(dirPath);
}

export function cleanupAllArchiveWorkDirs(): void {
  for (const dir of Array.from(managedWorkDirs)) {
    releaseArchiveWorkDir(dir);
  }
}

function isSafeZipRelativePath(entryName: string): boolean {
  if (!entryName || entryName.includes('\0')) return false;
  if (path.isAbsolute(entryName)) return false;
  const normalized = path.posix.normalize(entryName.replace(/\\/g, '/'));
  return !normalized.startsWith('../') && normalized !== '..';
}

function sanitizeAssetFilename(name: string): string {
  const ext = path.extname(name);
  const base =
    path
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

function isRelativeLocalAsset(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('letra-asset://')
  ) {
    return false;
  }
  return true;
}

/**
 * When converting a plain .md file (with ./assets/ or relative images) into a .letra
 * bundle, collects any referenced local files into workDir/assets/ and normalizes links.
 */
function collectExternalAssetsIntoWorkDir(
  content: string,
  sourceMdDir: string,
  workDir: string
): string {
  const assetsDir = path.join(workDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const refPattern = /(!?\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))|(\bsrc\s*=\s*["'])([^"']+)(["'])/gi;
  const copiedMap = new Map<string, string>();

  return content.replace(
    refPattern,
    (
      full,
      mdPrefix: string | undefined,
      mdUrl: string | undefined,
      mdSuffix: string | undefined,
      htmlPrefix: string | undefined,
      htmlUrl: string | undefined,
      htmlSuffix: string | undefined
    ) => {
      const rawUrl = mdUrl ?? htmlUrl ?? '';
      if (!isRelativeLocalAsset(rawUrl)) return full;

      let decodedUrl = rawUrl;
      try {
        decodedUrl = decodeURIComponent(rawUrl);
      } catch {
        decodedUrl = rawUrl;
      }

      const absSource = path.resolve(sourceMdDir, decodedUrl);
      if (!fs.existsSync(absSource) || fs.statSync(absSource).isDirectory()) {
        return full;
      }

      // Skip markdown/doc links unless inside assets folder or non-markdown media
      const ext = path.extname(absSource).toLowerCase();
      if (!mdPrefix?.startsWith('!') && !htmlPrefix && (ext === '.md' || ext === '.markdown' || ext === '.letra')) {
        return full;
      }

      let mappedRel = copiedMap.get(absSource);
      if (!mappedRel) {
        const cleanName = sanitizeAssetFilename(path.basename(absSource));
        const { fullPath, finalName } = uniqueFilePath(assetsDir, cleanName);
        fs.copyFileSync(absSource, fullPath);
        mappedRel = `./assets/${finalName}`;
        copiedMap.set(absSource, mappedRel);
      }

      if (mdPrefix !== undefined) {
        return `${mdPrefix}${mappedRel}${mdSuffix ?? ''}`;
      }
      return `${htmlPrefix ?? ''}${mappedRel}${htmlSuffix ?? ''}`;
    }
  );
}

function addDirectoryToZip(zipFolder: JSZip, fsDir: string): void {
  if (!fs.existsSync(fsDir)) return;
  const entries = fs.readdirSync(fsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(fsDir, entry.name);
    if (entry.isDirectory()) {
      const child = zipFolder.folder(entry.name);
      if (child) addDirectoryToZip(child, full);
    } else if (entry.isFile()) {
      zipFolder.file(entry.name, fs.readFileSync(full));
    }
  }
}

export async function readLetraArchive(archivePath: string): Promise<{
  filePath: string;
  content: string;
  title: string;
  stagedAssetDir: string;
}> {
  const buffer = fs.readFileSync(archivePath);
  const zip = await JSZip.loadAsync(buffer);
  const workDir = createManagedBundleWorkDir();

  let entryFileName = 'document.md';
  const manifestEntry = zip.file('manifest.json');
  if (manifestEntry) {
    try {
      const parsed = JSON.parse(await manifestEntry.async('string')) as Partial<LetraManifest>;
      if (parsed.entry && isSafeZipRelativePath(parsed.entry)) {
        entryFileName = parsed.entry;
      }
    } catch {
      // ignore malformed manifest and fall back to document.md
    }
  }

  let markdownEntry = zip.file(entryFileName);
  if (!markdownEntry) {
    const mdCandidates = Object.values(zip.files).filter(
      (f) => !f.dir && /\.(md|markdown)$/i.test(f.name) && isSafeZipRelativePath(f.name)
    );
    markdownEntry = mdCandidates[0] || null;
  }

  const content = markdownEntry ? await markdownEntry.async('string') : '';

  // Extract assets and any bundled supporting files into workDir
  for (const zipEntry of Object.values(zip.files)) {
    if (zipEntry.dir) continue;
    if (!isSafeZipRelativePath(zipEntry.name)) continue;
    if (zipEntry.name === 'manifest.json' || (markdownEntry && zipEntry.name === markdownEntry.name)) {
      continue;
    }
    const destPath = path.join(workDir, zipEntry.name);
    const resolvedDest = path.resolve(destPath);
    if (!resolvedDest.startsWith(path.resolve(workDir) + path.sep)) continue;
    fs.mkdirSync(path.dirname(resolvedDest), { recursive: true });
    const data = await zipEntry.async('nodebuffer');
    fs.writeFileSync(resolvedDest, data);
  }

  return {
    filePath: archivePath,
    content,
    title: path.basename(archivePath),
    stagedAssetDir: workDir,
  };
}

export async function writeLetraArchive(params: {
  targetPath: string;
  content: string;
  stagedAssetDir: string | null;
  sourceMdPath?: string | null;
}): Promise<{
  filePath: string;
  title: string;
  updatedContent: string;
  stagedAssetDir: string;
}> {
  const workDir =
    params.stagedAssetDir && fs.existsSync(params.stagedAssetDir)
      ? params.stagedAssetDir
      : createManagedBundleWorkDir();
  managedWorkDirs.add(workDir);
  fs.mkdirSync(path.join(workDir, 'assets'), { recursive: true });

  let finalContent = params.content;
  if (params.sourceMdPath && !params.sourceMdPath.toLowerCase().endsWith('.letra')) {
    finalContent = collectExternalAssetsIntoWorkDir(
      finalContent,
      path.dirname(params.sourceMdPath),
      workDir
    );
  }

  const zip = new JSZip();
  const title = path.basename(params.targetPath);
  const manifest: LetraManifest = {
    format: 'letra',
    version: 1,
    entry: 'document.md',
    title: path.basename(params.targetPath, path.extname(params.targetPath)),
    updatedAt: new Date().toISOString(),
  };

  zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  zip.file('document.md', finalContent);

  const assetsFolder = zip.folder('assets');
  if (assetsFolder) {
    addDirectoryToZip(assetsFolder, path.join(workDir, 'assets'));
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Atomic write so existing .letra bundles are never left partially written
  const tmpPath = `${params.targetPath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, zipBuffer);
  fs.renameSync(tmpPath, params.targetPath);

  return {
    filePath: params.targetPath,
    title,
    updatedContent: finalContent,
    stagedAssetDir: workDir,
  };
}
