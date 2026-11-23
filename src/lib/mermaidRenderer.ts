import mermaid from 'mermaid';
import type { ResolvedTheme } from '../../shared/types';

const svgCache = new Map<string, string>();
let activeMermaidTheme: ResolvedTheme | null = null;
let renderSeq = 0;

function ensureMermaidTheme(theme: ResolvedTheme) {
  if (activeMermaidTheme === theme) return;
  activeMermaidTheme = theme;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'neutral',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    flowchart: { curve: 'basis', htmlLabels: true, useMaxWidth: true },
    sequence: { useMaxWidth: true },
    themeVariables:
      theme === 'dark'
        ? {
            background: '#181b21',
            primaryColor: '#242b3d',
            primaryTextColor: '#e6e8ec',
            primaryBorderColor: '#4f5d7a',
            lineColor: '#7b8aa8',
            secondaryColor: '#1f242f',
            tertiaryColor: '#191d26',
          }
        : {
            background: '#fafbfc',
            primaryColor: '#eef2ff',
            primaryTextColor: '#1e2430',
            primaryBorderColor: '#818cf8',
            lineColor: '#64748b',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#ffffff',
          },
  });
}

export async function renderMermaidSvg(
  source: string,
  theme: ResolvedTheme
): Promise<{ svg?: string; error?: string }> {
  const key = `${theme}::${source}`;
  const cached = svgCache.get(key);
  if (cached) return { svg: cached };

  ensureMermaidTheme(theme);
  const id = `letra-mmd-${Date.now()}-${++renderSeq}`;

  try {
    const { svg } = await mermaid.render(id, source);
    // Keep cache bounded
    if (svgCache.size > 120) {
      const oldestKey = svgCache.keys().next().value;
      if (oldestKey) svgCache.delete(oldestKey);
    }
    svgCache.set(key, svg);
    return { svg };
  } catch (err) {
    // Remove leftover mermaid error node if mermaid injected one into body
    const stray = document.getElementById(`d${id}`);
    stray?.remove();
    return {
      error: err instanceof Error ? err.message : 'Invalid Mermaid diagram syntax',
    };
  }
}

export async function hydrateMermaidInContainer(
  container: HTMLElement,
  theme: ResolvedTheme
): Promise<boolean> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('.letra-mermaid-block[data-mermaid-source]'));
  if (blocks.length === 0) return false;

  let changed = false;
  for (const block of blocks) {
    const encoded = block.getAttribute('data-mermaid-source') || '';
    if (!encoded) continue;
    let source = encoded;
    try {
      source = decodeURIComponent(encoded);
    } catch {
      source = encoded;
    }
    if (block.getAttribute('data-mermaid-theme') === theme && block.querySelector('svg')) {
      continue;
    }

    const res = await renderMermaidSvg(source, theme);
    if (res.svg) {
      block.innerHTML = res.svg;
      block.setAttribute('data-mermaid-theme', theme);
      changed = true;
    } else if (res.error) {
      block.innerHTML = `<div class="letra-mermaid-error"><strong>Diagram syntax error</strong><pre>${escapeSimple(res.error)}</pre></div>`;
      block.setAttribute('data-mermaid-theme', theme);
      changed = true;
    }
  }
  return changed;
}

function escapeSimple(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
