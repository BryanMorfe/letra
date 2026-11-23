export interface PaginatedSlice {
  pageNumber: number;
  html: string;
}

function getOuterHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  return rect.height + marginTop + marginBottom;
}

function isHeadingTag(tagName: string): boolean {
  return /^H[1-6]$/.test(tagName);
}

/**
 * Splits a live measured container's top-level block elements into print-ready
 * page slices matching the target printable height, honoring explicit page breaks
 * and heading orphan prevention.
 */
export function paginateMeasuredContainer(
  measureRoot: HTMLElement,
  printableHeightPx: number
): PaginatedSlice[] {
  const children = Array.from(measureRoot.children) as HTMLElement[];
  if (children.length === 0) {
    return [{ pageNumber: 1, html: '' }];
  }

  const maxHeight = Math.max(120, printableHeightPx);
  const pages: string[][] = [];
  let currentNodes: HTMLElement[] = [];
  let currentHeight = 0;

  const commitPage = () => {
    pages.push(currentNodes.map((n) => n.outerHTML));
    currentNodes = [];
    currentHeight = 0;
  };

  for (let i = 0; i < children.length; i += 1) {
    const el = children[i];

    // Explicit page break
    if (el.hasAttribute('data-page-break') || el.classList.contains('letra-page-break')) {
      if (currentNodes.length > 0) {
        commitPage();
      }
      continue;
    }

    const h = getOuterHeight(el);
    const nextEl = children[i + 1];
    const nextH = nextEl && !nextEl.hasAttribute('data-page-break') ? getOuterHeight(nextEl) : 0;

    // Prevent orphan heading at the very bottom of a page
    const isOrphanHeading =
      isHeadingTag(el.tagName) &&
      currentNodes.length > 0 &&
      currentHeight + h + Math.min(nextH, 90) > maxHeight;

    if (isOrphanHeading) {
      commitPage();
      currentNodes.push(el);
      currentHeight = h;
      continue;
    }

    // Standard overflow onto next page
    if (currentNodes.length > 0 && currentHeight + h > maxHeight) {
      // If it's a long list or table that exceeds remaining space, push cleanly to next page
      commitPage();
    }

    currentNodes.push(el);
    currentHeight += h;
  }

  if (currentNodes.length > 0 || pages.length === 0) {
    commitPage();
  }

  return pages.map((blocks, idx) => ({
    pageNumber: idx + 1,
    html: blocks.join('\n'),
  }));
}
