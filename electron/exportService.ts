import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  MM_PER_INCH,
  getResolvedPageSizeMm,
} from '../shared/pagePresets';
import type {
  ExportHtmlRequest,
  ExportPdfRequest,
  HeaderFooterSlots,
  ResolvedTheme,
  TypographyStyle,
} from '../shared/types';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadKatexCss(inlineFontsAsFileUrls: boolean): string {
  const candidates = [
    path.join(process.cwd(), 'node_modules/katex/dist/katex.min.css'),
    path.join(__dirname, '../node_modules/katex/dist/katex.min.css'),
    path.join(process.resourcesPath || '', 'app.asar/node_modules/katex/dist/katex.min.css'),
  ];
  for (const cssPath of candidates) {
    if (fs.existsSync(cssPath)) {
      let css = fs.readFileSync(cssPath, 'utf8');
      if (inlineFontsAsFileUrls) {
        const fontsDir = path.join(path.dirname(cssPath), 'fonts');
        const fontsUrl = pathToFileURL(fontsDir).href;
        css = css.replace(/url\(fonts\//g, `url(${fontsUrl}/`);
      } else {
        // For standalone HTML export, use CDN fallback for KaTeX fonts while keeping CSS self-contained
        css = css.replace(
          /url\(fonts\//g,
          'url(https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/fonts/'
        );
      }
      return css;
    }
  }
  return '';
}

function getTypographyFontStack(style: TypographyStyle): { body: string; heading: string } {
  switch (style) {
    case 'sans':
      return {
        body: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
        heading: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
      };
    case 'serif':
    default:
      return {
        body: "'Iowan Old Style', 'Charter', 'Georgia', 'Times New Roman', serif",
        heading: "'Iowan Old Style', 'Charter', 'Georgia', 'Times New Roman', serif",
      };
  }
}

function buildDocumentCss(
  theme: ResolvedTheme,
  typography: TypographyStyle,
  headingDividers: boolean,
  fontSizePx: number,
  isPrint: boolean
): string {
  const isDark = !isPrint && theme === 'dark';
  const fonts = getTypographyFontStack(typography);
  const bg = isDark ? '#141518' : '#ffffff';
  const fg = isDark ? '#e6e8ec' : '#1a1d21';
  const muted = isDark ? '#98a0ad' : '#5e6673';
  const border = isDark ? '#2a2e37' : '#e4e7ec';
  const codeBg = isDark ? '#1d2026' : '#f5f6f8';
  const quoteBg = isDark ? 'rgba(255,255,255,0.03)' : '#f8f9fb';

  return `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: ${bg};
      color: ${fg};
      font-family: ${fonts.body};
      font-size: ${fontSizePx}px;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .letra-prose {
      color: ${fg};
      word-wrap: break-word;
    }
    .letra-prose h1, .letra-prose h2, .letra-prose h3, .letra-prose h4, .letra-prose h5, .letra-prose h6 {
      font-family: ${fonts.heading};
      font-weight: 650;
      line-height: 1.25;
      letter-spacing: -0.02em;
      margin-top: 1.5em;
      margin-bottom: 0.55em;
      break-after: avoid;
      page-break-after: avoid;
    }
    .letra-prose h1 { font-size: 2.05em; margin-top: 0; ${headingDividers ? `padding-bottom: 0.3em; border-bottom: 1px solid ${border};` : ''} }
    .letra-prose h2 { font-size: 1.5em; ${headingDividers ? `padding-bottom: 0.22em; border-bottom: 1px solid ${border};` : ''} }
    .letra-prose h3 { font-size: 1.22em; }
    .letra-prose h4 { font-size: 1.05em; }
    .letra-prose p { margin: 0 0 0.95em 0; }
    .letra-prose a { color: ${isDark ? '#7aa7ff' : '#2563eb'}; text-decoration: none; border-bottom: 1px solid currentColor; }
    .letra-prose ul, .letra-prose ol { margin: 0 0 1em 0; padding-left: 1.65em; }
    .letra-prose li { margin: 0.28em 0; }
    .letra-prose li > input[type="checkbox"] { margin-right: 0.5em; accent-color: #4f46e5; }
    .letra-prose blockquote {
      margin: 1.1em 0;
      padding: 0.7em 1.1em;
      border-left: 3px solid ${isDark ? '#6366f1' : '#4f46e5'};
      background: ${quoteBg};
      border-radius: 0 8px 8px 0;
      color: ${muted};
    }
    .letra-prose blockquote > :last-child { margin-bottom: 0; }
    .letra-prose pre {
      background: ${codeBg};
      border: 1px solid ${border};
      border-radius: 8px;
      padding: 0.95em 1.1em;
      overflow-x: auto;
      font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
      font-size: 0.86em;
      line-height: 1.55;
      margin: 1.1em 0;
      break-inside: avoid;
    }
    .letra-prose code {
      font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
      font-size: 0.88em;
    }
    .letra-prose :not(pre) > code {
      background: ${codeBg};
      border: 1px solid ${border};
      padding: 0.14em 0.38em;
      border-radius: 5px;
    }
    .letra-prose table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 0.92em;
      break-inside: avoid;
    }
    .letra-prose th, .letra-prose td {
      border: 1px solid ${border};
      padding: 0.55em 0.85em;
      text-align: left;
    }
    .letra-prose th {
      background: ${codeBg};
      font-weight: 600;
    }
    .letra-prose img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      display: block;
      margin: 1em auto;
      break-inside: avoid;
    }
    .letra-prose hr {
      border: 0;
      border-top: 1px solid ${border};
      margin: 1.8em 0;
    }
    .letra-prose .letra-page-break {
      break-before: page;
      page-break-before: always;
      height: 0;
      margin: 0;
      border: 0;
    }
    .letra-prose .letra-mermaid-block {
      display: flex;
      justify-content: center;
      margin: 1.3em 0;
      padding: 1em;
      background: ${isDark ? '#181b21' : '#fafbfc'};
      border: 1px solid ${border};
      border-radius: 10px;
      break-inside: avoid;
    }
    .letra-prose .letra-mermaid-block svg {
      max-width: 100%;
      height: auto;
    }
    .letra-prose .letra-callout {
      margin: 1.15em 0;
      padding: 0.85em 1.1em;
      border-radius: 8px;
      border-left: 3.5px solid #4f46e5;
      background: ${isDark ? 'rgba(99,102,241,0.1)' : '#f5f7ff'};
      break-inside: avoid;
    }
    .letra-prose .letra-callout-title {
      font-weight: 650;
      font-size: 0.88em;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      margin-bottom: 0.35em;
    }
    .letra-prose .letra-callout-tip { border-left-color: #10b981; background: ${isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf7'}; }
    .letra-prose .letra-callout-important { border-left-color: #8b5cf6; background: ${isDark ? 'rgba(139,92,246,0.1)' : '#f8f5ff'}; }
    .letra-prose .letra-callout-warning { border-left-color: #f59e0b; background: ${isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb'}; }
    .letra-prose .letra-callout-caution { border-left-color: #ef4444; background: ${isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'}; }
    .letra-prose .katex-display {
      overflow-x: auto;
      padding: 0.4em 0;
      margin: 1em 0;
    }
    .letra-prose kbd {
      background: ${codeBg};
      border: 1px solid ${border};
      border-bottom-width: 2px;
      border-radius: 5px;
      padding: 0.1em 0.42em;
      font-size: 0.84em;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .letra-prose mark {
      background: rgba(250, 204, 21, 0.35);
      color: inherit;
      padding: 0.05em 0.25em;
      border-radius: 3px;
    }
    .letra-prose details {
      border: 1px solid ${border};
      border-radius: 8px;
      padding: 0.6em 0.9em;
      margin: 1em 0;
    }
    .letra-prose summary {
      font-weight: 600;
      cursor: pointer;
    }
    /* Highlight.js tokens */
    .hljs-comment, .hljs-quote { color: ${isDark ? '#7c8594' : '#6a737d'}; font-style: italic; }
    .hljs-keyword, .hljs-selector-tag { color: ${isDark ? '#c792ea' : '#cf222e'}; }
    .hljs-string, .hljs-attr, .hljs-template-tag { color: ${isDark ? '#a5d6a7' : '#0a3069'}; }
    .hljs-number, .hljs-literal, .hljs-variable { color: ${isDark ? '#f78c6c' : '#0550ae'}; }
    .hljs-title, .hljs-function, .hljs-section { color: ${isDark ? '#82aaff' : '#6639ba'}; }
    .hljs-built_in, .hljs-type, .hljs-class .hljs-title { color: ${isDark ? '#ffcb6b' : '#953800'}; }
  `;
}

function buildChromiumHeaderFooterTemplate(
  slots: HeaderFooterSlots,
  title: string,
  dateStr: string,
  marginLeftMm: number,
  marginRightMm: number,
  isHeader: boolean
): string {
  const renderSlot = (raw: string) => {
    const escaped = escapeHtml(raw || '');
    return escaped
      .replace(/\{title\}/gi, escapeHtml(title))
      .replace(/\{date\}/gi, escapeHtml(dateStr))
      .replace(/\{page\}/gi, '<span class="pageNumber"></span>')
      .replace(/\{pages\}/gi, '<span class="totalPages"></span>');
  };

  const hasContent = Boolean(slots.left || slots.center || slots.right);
  if (!hasContent) return '<div></div>';

  return `
    <div style="
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      font-size: 8.5pt;
      color: #6b7280;
      padding: ${isHeader ? '0' : '4px'} ${marginRightMm}mm ${isHeader ? '4px' : '0'} ${marginLeftMm}mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
    ">
      <div style="flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${renderSlot(slots.left)}</div>
      <div style="flex: 1; text-align: center; white-space: nowrap;">${renderSlot(slots.center)}</div>
      <div style="flex: 1; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${renderSlot(slots.right)}</div>
    </div>
  `;
}

export async function exportDocumentToPdf(
  parentWindow: BrowserWindow | null,
  req: ExportPdfRequest
): Promise<{ canceled: boolean; filePath?: string; error?: string }> {
  const defaultName = `${req.title.replace(/\.[^/.]+$/, '') || 'Untitled'}.pdf`;
  const dialogOptions = {
    title: 'Export as PDF',
    defaultPath: req.documentPath
      ? path.join(path.dirname(req.documentPath), defaultName)
      : defaultName,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  };
  const { canceled, filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const { widthMm, heightMm } = getResolvedPageSizeMm(req.pageSettings);
  const { marginsMm } = req.pageSettings;
  const katexCss = loadKatexCss(true);
  const docCss = buildDocumentCss(
    'light',
    req.pageSettings.typography,
    req.pageSettings.headingDividers,
    req.pageSettings.fontSizePx,
    true
  );

  // Use CSS @page margins and Electron printToPDF margins carefully so headers/footers have breathing room
  const topMm = Math.max(req.pageSettings.showHeader ? 16 : 5, marginsMm.top);
  const bottomMm = Math.max(req.pageSettings.showFooter ? 16 : 5, marginsMm.bottom);

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(req.title)}</title>
  <style>${katexCss}</style>
  <style>
    ${docCss}
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: ${topMm}mm ${marginsMm.right}mm ${bottomMm}mm ${marginsMm.left}mm;
    }
    body {
      background: #ffffff !important;
      color: #1a1d21 !important;
    }
    .letra-code-copy-btn { display: none !important; }
  </style>
</head>
<body>
  <article class="letra-prose">${req.htmlBody}</article>
</body>
</html>`;

  const printWin = new BrowserWindow({
    show: false,
    width: Math.round((widthMm / MM_PER_INCH) * 96),
    height: Math.round((heightMm / MM_PER_INCH) * 96),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await printWin.webContents.executeJavaScript(`
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...Array.from(document.images).map(img =>
          img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })
        )
      ])
    `);

    const dateStr = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const showHF = req.pageSettings.showHeader || req.pageSettings.showFooter;
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: false,
      pageSize: {
        width: widthMm / MM_PER_INCH,
        height: heightMm / MM_PER_INCH,
      },
      margins: {
        top: topMm / MM_PER_INCH,
        bottom: bottomMm / MM_PER_INCH,
        left: marginsMm.left / MM_PER_INCH,
        right: marginsMm.right / MM_PER_INCH,
      },
      displayHeaderFooter: showHF,
      headerTemplate: req.pageSettings.showHeader
        ? buildChromiumHeaderFooterTemplate(
            req.pageSettings.header,
            req.title,
            dateStr,
            marginsMm.left,
            marginsMm.right,
            true
          )
        : '<div></div>',
      footerTemplate: req.pageSettings.showFooter
        ? buildChromiumHeaderFooterTemplate(
            req.pageSettings.footer,
            req.title,
            dateStr,
            marginsMm.left,
            marginsMm.right,
            false
          )
        : '<div></div>',
    });

    fs.writeFileSync(filePath, pdfBuffer);
    return { canceled: false, filePath };
  } catch (err) {
    return { canceled: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    printWin.destroy();
  }
}

export async function exportDocumentToHtml(
  parentWindow: BrowserWindow | null,
  req: ExportHtmlRequest
): Promise<{ canceled: boolean; filePath?: string; error?: string }> {
  const defaultName = `${req.title.replace(/\.[^/.]+$/, '') || 'Untitled'}.html`;
  const dialogOptions = {
    title: 'Export as Standalone HTML',
    defaultPath: defaultName,
    filters: [{ name: 'HTML Document', extensions: ['html', 'htm'] }],
  };
  const { canceled, filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (canceled || !filePath) {
    return { canceled: true };
  }

  try {
    const { widthMm } = getResolvedPageSizeMm(req.pageSettings);
    const { marginsMm } = req.pageSettings;
    const katexCss = loadKatexCss(false);
    const docCss = buildDocumentCss(
      req.theme,
      req.pageSettings.typography,
      req.pageSettings.headingDividers,
      req.pageSettings.fontSizePx,
      false
    );
    const isDark = req.theme === 'dark';

    const containerStyle =
      req.canvasMode === 'page'
        ? `
          body { background: ${isDark ? '#0e1014' : '#eef0f4'}; padding: 36px 20px; }
          .letra-export-sheet {
            max-width: ${widthMm}mm;
            margin: 0 auto;
            background: ${isDark ? '#141518' : '#ffffff'};
            padding: ${marginsMm.top}mm ${marginsMm.right}mm ${marginsMm.bottom}mm ${marginsMm.left}mm;
            border-radius: 6px;
            box-shadow: 0 12px 36px rgba(0,0,0,${isDark ? '0.45' : '0.1'});
          }
        `
        : `
          .letra-export-sheet {
            max-width: 780px;
            margin: 0 auto;
            padding: 48px 28px 80px;
          }
        `;

    const fullHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(req.title)}</title>
  <style>${katexCss}</style>
  <style>
    ${docCss}
    ${containerStyle}
    .letra-code-copy-btn { display: none; }
  </style>
</head>
<body>
  <main class="letra-export-sheet">
    <article class="letra-prose">${req.htmlBody}</article>
  </main>
</body>
</html>`;

    fs.writeFileSync(filePath, fullHtml, 'utf8');
    return { canceled: false, filePath };
  } catch (err) {
    return { canceled: false, error: err instanceof Error ? err.message : String(err) };
  }
}
