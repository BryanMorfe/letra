import JSZip from 'jszip';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createManagedBundleWorkDir,
  readLetraArchive,
  releaseArchiveWorkDir,
  writeLetraArchive,
} from './letraArchive';

const tempRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'letra-test-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('.letra archive format', () => {
  it('writes, reads, edits, and re-saves a .letra ZIP bundle with assets', async () => {
    const outDir = makeTempDir();
    const archivePath = path.join(outDir, 'quarterly-report.letra');

    // Prepare initial staged asset
    const initialWork = createManagedBundleWorkDir();
    fs.writeFileSync(path.join(initialWork, 'assets', 'chart.png'), Buffer.from('FAKE_PNG_1'));

    const saved = await writeLetraArchive({
      targetPath: archivePath,
      content: '# Quarterly Report\n\n![Chart](./assets/chart.png)\n',
      stagedAssetDir: initialWork,
    });
    expect(fs.existsSync(archivePath)).toBe(true);
    expect(saved.title).toBe('quarterly-report.letra');

    // Verify ZIP entries directly
    const zip = await JSZip.loadAsync(fs.readFileSync(archivePath));
    expect(zip.file('document.md')).toBeTruthy();
    expect(zip.file('manifest.json')).toBeTruthy();
    expect(zip.file('assets/chart.png')).toBeTruthy();

    releaseArchiveWorkDir(saved.stagedAssetDir);

    // Re-open archive into fresh working session
    const opened = await readLetraArchive(archivePath);
    expect(opened.content).toContain('# Quarterly Report');
    expect(fs.existsSync(path.join(opened.stagedAssetDir, 'assets', 'chart.png'))).toBe(true);

    // Edit markdown and add a second asset, then save back into the same .letra file
    fs.writeFileSync(path.join(opened.stagedAssetDir, 'assets', 'photo.jpg'), Buffer.from('FAKE_JPG_2'));
    await writeLetraArchive({
      targetPath: archivePath,
      content: `${opened.content}\n![Photo](./assets/photo.jpg)\n`,
      stagedAssetDir: opened.stagedAssetDir,
    });

    const updatedZip = await JSZip.loadAsync(fs.readFileSync(archivePath));
    const updatedMd = await updatedZip.file('document.md')!.async('string');
    expect(updatedMd).toContain('![Photo](./assets/photo.jpg)');
    expect(updatedZip.file('assets/chart.png')).toBeTruthy();
    expect(updatedZip.file('assets/photo.jpg')).toBeTruthy();

    releaseArchiveWorkDir(opened.stagedAssetDir);
    expect(fs.existsSync(opened.stagedAssetDir)).toBe(false);
  });

  it('bundles external local assets automatically when converting a .md file to .letra', async () => {
    const dir = makeTempDir();
    const mdPath = path.join(dir, 'notes.md');
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'diagram.svg'), '<svg></svg>');

    const mdContent = '# Notes\n\n![Architecture](./assets/diagram.svg)\n';
    fs.writeFileSync(mdPath, mdContent, 'utf8');

    const letraPath = path.join(dir, 'notes.letra');
    const saved = await writeLetraArchive({
      targetPath: letraPath,
      content: mdContent,
      stagedAssetDir: null,
      sourceMdPath: mdPath,
    });

    const zip = await JSZip.loadAsync(fs.readFileSync(letraPath));
    expect(zip.file('assets/diagram.svg')).toBeTruthy();
    const extractedSvg = await zip.file('assets/diagram.svg')!.async('string');
    expect(extractedSvg).toBe('<svg></svg>');

    releaseArchiveWorkDir(saved.stagedAssetDir);
  });
});
