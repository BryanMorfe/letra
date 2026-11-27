import DOMPurify from 'dompurify';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { TocHeading } from '../../shared/types';
import { isLetraArchivePath } from '../../shared/types';

export interface RenderedDocument {
  html: string;
  headings: TocHeading[];
  wordCount: number;
  charCount: number;
  readingTimeMin: number;
  frontmatterTitle?: string;
}

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function extractText(node: HastNode): string {
  if (node.type === 'text' && typeof node.value === 'string') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(extractText).join('');
}

function normalizeExtendedSyntax(source: string): string {
  // Split by fenced code blocks and inline code spans so we never mutate code examples
  const segments = source.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g);
  return segments
    .map((seg, idx) => {
      if (idx % 2 === 1) return seg; // fenced or inline code

      // Convert standalone pagebreak markers to explicit div markers
      let out = seg.replace(
        /^[ \t]*(?:<!--\s*pagebreak\s*-->|\\newpage|\\pagebreak)[ \t]*$/gim,
        '\n<div class="letra-page-break" data-page-break="true"></div>\n'
      );

      // Convert \[ ... \] display math to $$ ... $$
      out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => `\n$$\n${inner.trim()}\n$$\n`);

      // Convert \( ... \) inline math to $ ... $
      out = out.replace(/\\\((.+?)\\\)/g, (_m, inner: string) => `$${inner.trim()}$`);

      return out;
    })
    .join('');
}

function rehypeMermaidBlocks() {
  return (tree: HastNode) => {
    visit(tree as never, 'element', (node: HastNode, index: number | undefined, parent: HastNode | undefined) => {
      if (!parent || typeof index !== 'number' || node.tagName !== 'pre' || !node.children?.length) {
        return;
      }
      const code = node.children.find((c) => c.type === 'element' && c.tagName === 'code');
      if (!code) return;
      const classes = Array.isArray(code.properties?.className)
        ? (code.properties?.className as string[])
        : [];
      const isMermaid = classes.some((cls) => cls === 'language-mermaid' || cls === 'language-mmd');
      if (!isMermaid) return;

      const rawCode = extractText(code).trim();
      parent.children![index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['letra-mermaid-block'],
          dataMermaidSource: encodeURIComponent(rawCode),
        },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['letra-mermaid-loading'] },
            children: [{ type: 'text', value: 'Rendering diagram…' }],
          },
        ],
      };
    });
  };
}

const CALLOUT_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i;
const CALLOUT_LABELS: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

function rehypeCallouts() {
  return (tree: HastNode) => {
    visit(tree as never, 'element', (node: HastNode) => {
      if (node.tagName !== 'blockquote' || !node.children?.length) return;
      const firstPara = node.children.find((c) => c.type === 'element' && c.tagName === 'p');
      if (!firstPara || !firstPara.children?.length) return;

      const firstChild = firstPara.children[0];
      if (firstChild.type !== 'text' || typeof firstChild.value !== 'string') return;

      const lines = firstChild.value.split('\n');
      const match = lines[0].trim().match(CALLOUT_REGEX);
      if (!match) return;

      const kind = match[1].toLowerCase();
      const customTitle = match[2]?.trim();
      const titleText = customTitle || CALLOUT_LABELS[kind] || kind.toUpperCase();

      const remainingFirstLine = lines.slice(1).join('\n').replace(/^\n/, '');
      if (remainingFirstLine) {
        firstChild.value = remainingFirstLine;
      } else {
        firstPara.children.shift();
        // Also strip leading <br> if present
        if (firstPara.children[0]?.type === 'element' && firstPara.children[0].tagName === 'br') {
          firstPara.children.shift();
        }
      }

      if (firstPara.children.length === 0) {
        const paraIdx = node.children.indexOf(firstPara);
        if (paraIdx !== -1) node.children.splice(paraIdx, 1);
      }

      node.tagName = 'div';
      node.properties = {
        className: ['letra-callout', `letra-callout-${kind}`],
        'data-callout': kind,
      };
      node.children.unshift({
        type: 'element',
        tagName: 'div',
        properties: { className: ['letra-callout-title'] },
        children: [{ type: 'text', value: titleText }],
      });
    });
  };
}

function rehypeCollectHeadings(headings: TocHeading[]) {
  return (tree: HastNode) => {
    visit(tree as never, 'element', (node: HastNode) => {
      if (!node.tagName || !/^h[1-6]$/.test(node.tagName)) return;
      const level = Number(node.tagName.slice(1));
      const id = typeof node.properties?.id === 'string' ? node.properties.id : '';
      const text = extractText(node).trim();
      if (text) {
        headings.push({ id, text, level });
      }
    });
  };
}

function rehypeCodeMeta() {
  return (tree: HastNode) => {
    visit(tree as never, 'element', (node: HastNode) => {
      if (node.tagName !== 'pre' || !node.children?.length) return;
      const code = node.children.find((c) => c.type === 'element' && c.tagName === 'code');
      if (!code) return;
      const classes = Array.isArray(code.properties?.className)
        ? (code.properties?.className as string[])
        : [];
      const langClass = classes.find((c) => c.startsWith('language-'));
      const lang = langClass ? langClass.replace('language-', '') : '';
      node.properties = {
        ...(node.properties || {}),
        'data-language': lang || 'text',
      };
    });
  };
}

function isRelativeAssetUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('letra-asset://') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:')
  ) {
    return false;
  }
  return true;
}

function dirnamePosixOrWin(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

function rehypeRewriteLocalAssets(baseDir: string | null) {
  return (tree: HastNode) => {
    if (!baseDir) return;
    visit(tree as never, 'element', (node: HastNode) => {
      if (!node.properties) return;
      const tag = node.tagName;
      if ((tag === 'img' || tag === 'video' || tag === 'audio' || tag === 'source') && typeof node.properties.src === 'string') {
        if (isRelativeAssetUrl(node.properties.src)) {
          const encodedPath = encodeURIComponent(node.properties.src);
          const encodedBase = encodeURIComponent(baseDir);
          node.properties.src = `letra-asset://local?path=${encodedPath}&base=${encodedBase}`;
        }
      }
    });
  };
}

function extractFrontmatterTitle(source: string): string | undefined {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const titleMatch = match[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return titleMatch?.[1]?.trim();
}

export function renderMarkdown(
  source: string,
  options?: { documentPath?: string | null; stagedAssetDir?: string | null }
): RenderedDocument {
  const headings: TocHeading[] = [];
  const frontmatterTitle = extractFrontmatterTitle(source);
  const normalized = normalizeExtendedSyntax(source);

  const isArchive = isLetraArchivePath(options?.documentPath);
  const baseDir = isArchive
    ? options?.stagedAssetDir || null
    : options?.documentPath
      ? dirnamePosixOrWin(options.documentPath)
      : options?.stagedAssetDir || null;

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeMermaidBlocks)
    .use(rehypeKatex, { throwOnError: false, strict: false, trust: true })
    .use(rehypeHighlight, { ignoreMissing: true, detect: false })
    .use(rehypeCodeMeta)
    .use(rehypeCallouts)
    .use(rehypeSlug)
    .use(rehypeCollectHeadings, headings)
    .use(rehypeRewriteLocalAssets, baseDir)
    .use(rehypeStringify, { allowDangerousHtml: true });

  const rawHtml = String(processor.processSync(normalized));

  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_TAGS: ['video', 'audio', 'source', 'details', 'summary', 'mark', 'kbd', 'figure', 'figcaption', 'semantics', 'annotation'],
    ADD_ATTR: [
      'class',
      'id',
      'style',
      'target',
      'rel',
      'controls',
      'playsinline',
      'autoplay',
      'loop',
      'muted',
      'poster',
      'open',
      'type',
      'checked',
      'disabled',
      'aria-hidden',
      'data-mermaid-source',
      'data-page-break',
      'data-language',
      'data-callout',
      'xmlns',
      'encoding',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data|blob|letra-asset):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });

  // Compute crisp document metrics excluding YAML frontmatter & markdown syntax clutter
  const plainText = source
    .replace(/^---[\s\S]*?---/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`~>\[\]()!|-]/g, ' ')
    .trim();
  const words = plainText ? plainText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const charCount = source.length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 220));

  return {
    html: cleanHtml,
    headings,
    wordCount,
    charCount,
    readingTimeMin,
    frontmatterTitle,
  };
}
