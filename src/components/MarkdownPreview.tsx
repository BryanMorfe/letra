import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Maximize2,
  RotateCw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CSS_PX_PER_MM,
  PAGE_PRESETS,
  formatHeaderFooterToken,
  getResolvedPageSizePx,
  mmToUnit,
} from '../../shared/pagePresets';
import type { PagePresetId, PageSettings, PreviewMode, ResolvedTheme } from '../../shared/types';
import { hydrateMermaidInContainer } from '../lib/mermaidRenderer';
import { paginateMeasuredContainer, type PaginatedSlice } from '../lib/paginator';
import { openExternalLink } from '../lib/platform';
import { PageSetupPopover } from './PageSetupPopover';

export interface MarkdownPreviewHandle {
  scrollToRatio: (ratio: number) => void;
  scrollToHeading: (headingId: string) => void;
  getHydratedHtml: () => string;
}

interface MarkdownPreviewProps {
  html: string;
  documentTitle: string;
  theme: ResolvedTheme;
  previewMode: PreviewMode;
  pageSettings: PageSettings;
  onChangePageSettings: (next: PageSettings) => void;
  onScrollRatio?: (ratio: number) => void;
  onPageCountChange?: (count: number) => void;
}

export const MarkdownPreview = React.forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  (
    {
      html,
      documentTitle,
      theme,
      previewMode,
      pageSettings,
      onChangePageSettings,
      onScrollRatio,
      onPageCountChange,
    },
    ref
  ) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const continuousArticleRef = useRef<HTMLElement>(null);
    const measureContainerRef = useRef<HTMLDivElement>(null);
    const isSyncingScrollRef = useRef(false);

    const [pages, setPages] = useState<PaginatedSlice[]>([{ pageNumber: 1, html }]);
    const [viewportWidth, setViewportWidth] = useState(900);
    const [setupOpen, setSetupOpen] = useState(false);
    const [forceWhitePaper, setForceWhitePaper] = useState(false);
    const [hydratedExportHtml, setHydratedExportHtml] = useState(html);

    const effectivePaperTheme: ResolvedTheme =
      previewMode === 'page' && forceWhitePaper ? 'light' : theme;

    const { widthPx: pageWidthPx, heightPx: pageHeightPx } = useMemo(
      () => getResolvedPageSizePx(pageSettings),
      [pageSettings]
    );

    const marginTopPx = Math.round(pageSettings.marginsMm.top * CSS_PX_PER_MM);
    const marginRightPx = Math.round(pageSettings.marginsMm.right * CSS_PX_PER_MM);
    const marginBottomPx = Math.round(pageSettings.marginsMm.bottom * CSS_PX_PER_MM);
    const marginLeftPx = Math.round(pageSettings.marginsMm.left * CSS_PX_PER_MM);

    const printableWidthPx = Math.max(180, pageWidthPx - marginLeftPx - marginRightPx);
    const printableHeightPx = Math.max(180, pageHeightPx - marginTopPx - marginBottomPx);

    // Track scroll container width for Fit Width zoom
    useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const update = () => setViewportWidth(el.clientWidth);
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }, [previewMode]);

    // Close popover on Escape
    useEffect(() => {
      if (!setupOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSetupOpen(false);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [setupOpen]);

    // Hydrate Mermaid in continuous view
    useEffect(() => {
      if (previewMode !== 'continuous') return;
      const container = continuousArticleRef.current;
      if (!container) return;

      let cancelled = false;
      container.innerHTML = html;
      attachCodeCopyButtons(container);

      hydrateMermaidInContainer(container, theme).then(() => {
        if (!cancelled && container) {
          setHydratedExportHtml(container.innerHTML);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [html, theme, previewMode]);

    // Measure & paginate in Page Mode
    useEffect(() => {
      if (previewMode !== 'page') return;
      const measureRoot = measureContainerRef.current;
      if (!measureRoot) return;

      let cancelled = false;
      measureRoot.innerHTML = html;

      const runPaginate = () => {
        if (cancelled || !measureContainerRef.current) return;
        const slices = paginateMeasuredContainer(measureContainerRef.current, printableHeightPx);
        setPages(slices);
        onPageCountChange?.(slices.length);
        setHydratedExportHtml(measureContainerRef.current.innerHTML);
      };

      const hydrateAndPaginate = async () => {
        await hydrateMermaidInContainer(measureRoot, effectivePaperTheme);
        if (cancelled) return;

        // Wait for images inside the document to load so pagination heights are exact
        const imgs = Array.from(measureRoot.querySelectorAll('img'));
        if (imgs.length > 0) {
          await Promise.all(
            imgs.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((res) => {
                    img.addEventListener('load', () => res(), { once: true });
                    img.addEventListener('error', () => res(), { once: true });
                  })
            )
          );
        }
        if (cancelled) return;
        requestAnimationFrame(runPaginate);
      };

      hydrateAndPaginate();
      return () => {
        cancelled = true;
      };
    }, [
      html,
      previewMode,
      effectivePaperTheme,
      printableWidthPx,
      printableHeightPx,
      pageSettings.typography,
      pageSettings.fontSizePx,
      onPageCountChange,
    ]);

    const scaleFactor = useMemo(() => {
      if (pageSettings.zoom === 'fit-width') {
        const available = Math.max(240, viewportWidth - 48);
        return Math.min(1.12, Math.max(0.28, available / pageWidthPx));
      }
      return pageSettings.zoom;
    }, [pageSettings.zoom, viewportWidth, pageWidthPx]);

    const handleContainerClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const copyBtn = target.closest<HTMLButtonElement>('.letra-code-copy-btn');
      if (copyBtn) {
        const pre = copyBtn.closest('pre');
        const code = pre?.querySelector('code')?.textContent || '';
        navigator.clipboard?.writeText(code);
        copyBtn.textContent = 'Copied';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1500);
        return;
      }

      const link = target.closest<HTMLAnchorElement>('a[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#')) {
        e.preventDefault();
        const id = decodeURIComponent(href.slice(1));
        const anchorTarget = scrollContainerRef.current?.querySelector(`[id="${CSS.escape(id)}"]`);
        anchorTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        e.preventDefault();
        openExternalLink(href);
      }
    };

    useImperativeHandle(ref, () => ({
      scrollToRatio: (ratio: number) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 0) return;
        isSyncingScrollRef.current = true;
        el.scrollTop = ratio * maxScroll;
        requestAnimationFrame(() => {
          isSyncingScrollRef.current = false;
        });
      },
      scrollToHeading: (headingId: string) => {
        const el = scrollContainerRef.current;
        if (!el || !headingId) return;
        const heading = el.querySelector(`[id="${CSS.escape(headingId)}"]`);
        heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      getHydratedHtml: () => {
        if (previewMode === 'continuous' && continuousArticleRef.current) {
          return continuousArticleRef.current.innerHTML;
        }
        if (previewMode === 'page' && measureContainerRef.current) {
          return measureContainerRef.current.innerHTML;
        }
        return hydratedExportHtml || html;
      },
    }));

    const dateStr = useMemo(
      () =>
        new Date().toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      []
    );

    const proseTypographyClass = `letra-typo-${pageSettings.typography}`;
    const presetShortLabel =
      pageSettings.preset === 'custom'
        ? `${mmToUnit(pageSettings.customWidthMm, pageSettings.unit)}×${mmToUnit(pageSettings.customHeightMm, pageSettings.unit)} ${pageSettings.unit}`
        : PAGE_PRESETS[pageSettings.preset].label;

    const adjustZoom = (delta: number) => {
      const current = typeof pageSettings.zoom === 'number' ? pageSettings.zoom : scaleFactor;
      const next = Math.min(2, Math.max(0.45, Math.round((current + delta) * 10) / 10));
      onChangePageSettings({ ...pageSettings, zoom: next });
    };

    return (
      <div className="relative flex flex-col h-full w-full overflow-hidden">
        {/* Page Mode Compact Strip */}
        {previewMode === 'page' && (
          <div className="relative z-20 shrink-0 border-b border-[var(--letra-border)] bg-[var(--letra-surface)]/85 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 px-3 h-9 overflow-x-auto no-scrollbar whitespace-nowrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <select
                  aria-label="Paper Size"
                  value={pageSettings.preset}
                  onChange={(e) =>
                    onChangePageSettings({
                      ...pageSettings,
                      preset: e.target.value as PagePresetId,
                    })
                  }
                  className="text-xs font-medium bg-transparent text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] rounded-md px-1.5 py-1 focus:outline-none cursor-pointer whitespace-nowrap"
                >
                  {Object.values(PAGE_PRESETS).map((p) => (
                    <option key={p.id} value={p.id} className="bg-[var(--letra-elevated)] text-[var(--letra-fg)]">
                      {p.label}
                    </option>
                  ))}
                  <option value="custom" className="bg-[var(--letra-elevated)] text-[var(--letra-fg)]">
                    Custom ({presetShortLabel})
                  </option>
                </select>

                <button
                  type="button"
                  title={`Switch to ${pageSettings.orientation === 'portrait' ? 'Landscape' : 'Portrait'}`}
                  onClick={() =>
                    onChangePageSettings({
                      ...pageSettings,
                      orientation: pageSettings.orientation === 'portrait' ? 'landscape' : 'portrait',
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCw className="w-3 h-3 shrink-0" />
                  <span className="capitalize">{pageSettings.orientation}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSetupOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    setupOpen
                      ? 'bg-indigo-500 text-white'
                      : 'bg-[var(--letra-hover)] text-[var(--letra-fg)] hover:bg-[var(--letra-border)]'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3 shrink-0" />
                  <span>Page Setup</span>
                </button>
              </div>

              {/* Right: Zoom & Page Count */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Zoom Out"
                  onClick={() => adjustZoom(-0.1)}
                  className="p-1 rounded-md text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Fit Width"
                  onClick={() =>
                    onChangePageSettings({
                      ...pageSettings,
                      zoom: pageSettings.zoom === 'fit-width' ? 1 : 'fit-width',
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer whitespace-nowrap"
                >
                  {pageSettings.zoom === 'fit-width' ? (
                    <>
                      <Maximize2 className="w-2.5 h-2.5 shrink-0" />
                      <span>{Math.round(scaleFactor * 100)}%</span>
                    </>
                  ) : (
                    <span>{Math.round(pageSettings.zoom * 100)}%</span>
                  )}
                </button>
                <button
                  type="button"
                  title="Zoom In"
                  onClick={() => adjustZoom(0.1)}
                  className="p-1 rounded-md text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="w-px h-3.5 mx-1 bg-[var(--letra-border)]" />
                <span className="text-[11px] text-[var(--letra-muted)] font-medium px-1 whitespace-nowrap">
                  {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                </span>
              </div>
            </div>

            {setupOpen && (
              <div className="absolute left-3 top-10 z-50">
                <PageSetupPopover
                  settings={pageSettings}
                  onChange={onChangePageSettings}
                  forceWhitePaper={forceWhitePaper}
                  onToggleForceWhitePaper={setForceWhitePaper}
                  isDarkTheme={theme === 'dark'}
                  onClose={() => setSetupOpen(false)}
                />
              </div>
            )}
          </div>
        )}

        {/* Main Scroll Viewport */}
        <div
          ref={scrollContainerRef}
          onClick={handleContainerClick}
          onScroll={(e) => {
            if (isSyncingScrollRef.current || !onScrollRatio) return;
            const el = e.currentTarget;
            const maxScroll = el.scrollHeight - el.clientHeight;
            if (maxScroll > 0) {
              onScrollRatio(el.scrollTop / maxScroll);
            }
          }}
          className={`flex-1 min-h-0 overflow-auto ${
            previewMode === 'page'
              ? 'bg-[var(--letra-desk-bg)] py-8 px-6'
              : 'bg-[var(--letra-preview-bg)]'
          }`}
        >
          {previewMode === 'continuous' ? (
            <div className="mx-auto max-w-[760px] px-8 sm:px-12 py-10 pb-24">
              <article
                ref={continuousArticleRef}
                className={`letra-prose ${proseTypographyClass}`}
                style={{ fontSize: `${pageSettings.fontSizePx}px` }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-7 pb-16">
              {pages.map((slice) => {
                const hideHF = pageSettings.differentFirstPage && slice.pageNumber === 1;
                const tokenVars = {
                  title: documentTitle.replace(/\.[^/.]+$/, '') || 'Untitled',
                  page: slice.pageNumber,
                  pages: pages.length,
                  date: dateStr,
                };
                const scaledW = Math.round(pageWidthPx * scaleFactor);
                const scaledH = Math.round(pageHeightPx * scaleFactor);

                return (
                  <div
                    key={slice.pageNumber}
                    className="relative shrink-0"
                    style={{ width: `${scaledW}px`, height: `${scaledH}px` }}
                  >
                    <div
                      data-paper-theme={effectivePaperTheme}
                      className={`letra-paper-sheet origin-top-left relative overflow-hidden ${
                        effectivePaperTheme === 'dark'
                          ? 'bg-[#1a1d24] text-[#e6e8ec] ring-1 ring-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.55)]'
                          : 'bg-white text-[#1a1d21] ring-1 ring-slate-900/8 shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_42px_rgba(15,23,42,0.10)]'
                      }`}
                      style={{
                        width: `${pageWidthPx}px`,
                        height: `${pageHeightPx}px`,
                        transform: `scale(${scaleFactor})`,
                        borderRadius: '4px',
                      }}
                    >
                      {/* Running Header inside top margin */}
                      {pageSettings.showHeader && !hideHF && (
                        <div
                          className="absolute top-0 left-0 right-0 flex items-end justify-between text-[11px] select-none pointer-events-none opacity-60"
                          style={{
                            height: `${Math.max(24, marginTopPx - 12)}px`,
                            paddingLeft: `${marginLeftPx}px`,
                            paddingRight: `${marginRightPx}px`,
                            paddingBottom: '6px',
                          }}
                        >
                          <span className="truncate max-w-[38%]">
                            {formatHeaderFooterToken(pageSettings.header.left, tokenVars)}
                          </span>
                          <span className="truncate max-w-[30%] text-center">
                            {formatHeaderFooterToken(pageSettings.header.center, tokenVars)}
                          </span>
                          <span className="truncate max-w-[38%] text-right">
                            {formatHeaderFooterToken(pageSettings.header.right, tokenVars)}
                          </span>
                        </div>
                      )}

                      {/* Printable Body */}
                      <div
                        className="absolute overflow-hidden"
                        style={{
                          top: `${marginTopPx}px`,
                          right: `${marginRightPx}px`,
                          bottom: `${marginBottomPx}px`,
                          left: `${marginLeftPx}px`,
                        }}
                      >
                        <article
                          className={`letra-prose ${proseTypographyClass} ${
                            effectivePaperTheme === 'light' ? 'letra-prose-force-light' : ''
                          }`}
                          style={{ fontSize: `${pageSettings.fontSizePx}px` }}
                          dangerouslySetInnerHTML={{ __html: slice.html }}
                        />
                      </div>

                      {/* Running Footer inside bottom margin */}
                      {pageSettings.showFooter && !hideHF && (
                        <div
                          className="absolute bottom-0 left-0 right-0 flex items-start justify-between text-[11px] select-none pointer-events-none opacity-60"
                          style={{
                            height: `${Math.max(24, marginBottomPx - 10)}px`,
                            paddingLeft: `${marginLeftPx}px`,
                            paddingRight: `${marginRightPx}px`,
                            paddingTop: '8px',
                          }}
                        >
                          <span className="truncate max-w-[38%]">
                            {formatHeaderFooterToken(pageSettings.footer.left, tokenVars)}
                          </span>
                          <span className="truncate max-w-[30%] text-center">
                            {formatHeaderFooterToken(pageSettings.footer.center, tokenVars)}
                          </span>
                          <span className="truncate max-w-[38%] text-right">
                            {formatHeaderFooterToken(pageSettings.footer.right, tokenVars)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Offscreen Pagination Measurement Surface (exact printable width) */}
        {previewMode === 'page' && (
          <div
            aria-hidden="true"
            className="fixed -left-[99999px] top-0 pointer-events-none opacity-0"
            style={{ width: `${printableWidthPx}px` }}
          >
            <div
              ref={measureContainerRef}
              className={`letra-prose ${proseTypographyClass}`}
              style={{ fontSize: `${pageSettings.fontSizePx}px` }}
            />
          </div>
        )}
      </div>
    );
  }
);

MarkdownPreview.displayName = 'MarkdownPreview';

function attachCodeCopyButtons(root: HTMLElement) {
  const pres = root.querySelectorAll<HTMLPreElement>('pre');
  pres.forEach((pre) => {
    if (pre.querySelector('.letra-code-copy-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'letra-code-copy-btn';
    btn.textContent = 'Copy';
    pre.appendChild(btn);
  });
}
