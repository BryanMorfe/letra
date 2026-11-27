export const WELCOME_MARKDOWN = `---
title: Welcome to Letra
---

# Welcome to Letra

**Letra** is a calm, print-ready Markdown studio crafted for technical writing, essays, research notes, and publication-grade documents on macOS and Linux.

> [!TIP]
> Try switching between **Raw**, **Split**, and **Preview** views in the top bar — or open **Preview Settings** to switch between **Open Canvas** and **Page** layouts (US Letter, Legal, A4, custom margins), toggle **Serif / Sans-Serif** fonts, and customize heading dividers.

---

## Rich Scientific & Technical Authoring

### LaTeX Mathematics

Write crisp inline equations like Euler's identity $e^{i\\pi} + 1 = 0$ or the Gaussian kernel $K(x, x') = \\exp\\left(-\\frac{\\|x - x'\\|^2}{2\\sigma^2}\\right)$, alongside full display equations:

$$
\\mathcal{L}(\\theta) = -\\frac{1}{N} \\sum_{i=1}^{N} \\left[ y_i \\log \\hat{y}_i(\\theta) + (1 - y_i) \\log\\big(1 - \\hat{y}_i(\\theta)\\big) \\right] + \\frac{\\lambda}{2} \\|\\theta\\|_2^2
$$

Standard LaTeX delimiters \`\\(...\\)\` and \`\\[...\\]\` work seamlessly too:

\\[
\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}, \\qquad \\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
\\]

### Diagrams with Mermaid

Architecture, flows, and state machines render live and automatically adapt to Light and Dark themes:

\`\`\`mermaid
flowchart LR
    A["Raw Markdown"] --> B["Unified + Remark"]
    B --> C["KaTeX Math"]
    B --> D["Mermaid SVG"]
    B --> E["Sanitized HTML"]
    C & D & E --> F{"View Mode"}
    F -->|Continuous| G["Fluid Reader"]
    F -->|Page Mode| H["Print-Ready Sheets & PDF"]
\`\`\`

---

## Tables, Code & Task Lists

| Paper Preset | Dimensions | Orientation | Best For |
| :--- | :--- | :--- | :--- |
| **US Letter** | 8.5 × 11 in | Portrait / Landscape | North American reports & briefs |
| **US Legal** | 8.5 × 14 in | Portrait / Landscape | Contracts & formal filings |
| **A4 (ISO)** | 210 × 297 mm | Portrait / Landscape | International papers & specs |
| **Custom** | Any mm or in | Custom margins | Zines, books, & slide handouts |

\`\`\`typescript
export function paginate(blocks: Block[], printableHeightPx: number): Page[] {
  return blocks.reduce<Page[]>((pages, block) => {
    const active = pages.at(-1);
    if (!active || active.height + block.height > printableHeightPx) {
      pages.push({ height: block.height, items: [block] });
    } else {
      active.height += block.height;
      active.items.push(block);
    }
    return pages;
  }, []);
}
\`\`\`

- [x] Raw, Split, and Preview modes with synchronized scrolling
- [x] LaTeX math, Mermaid diagrams, GFM tables, callouts, and Markdown HTML
- [x] Light, Dark, and System-adaptive appearance
- [x] Page Mode with custom sizes, margins, headers, footers & PDF/HTML export
- [x] Drag, paste, or import images and assets into \`./assets/\` or base64

<!-- pagebreak -->

## Embedded HTML & Callouts

Letra safely renders semantic Markdown HTML including collapsible sections, keyboard shortcuts, and highlighted notes.

<details open>
  <summary>Essential Keyboard Shortcuts</summary>
  <p style="margin-top: 8px;">
    Use <kbd>⌘/Ctrl</kbd> + <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to switch between Raw, Split, and Preview views.
    Press <kbd>⌘/Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>P</kbd> to toggle Page Mode, <kbd>⌘/Ctrl</kbd> + <kbd>\\</kbd> for the sidebar,
    and <kbd>⌘/Ctrl</kbd> + <kbd>E</kbd> to export a print-ready PDF.
  </p>
</details>

> [!NOTE] Portable \`.letra\` Packages & Assets
> Drag and drop any image, SVG, audio, or video directly onto the editor — or paste a screenshot from your clipboard. Save as plain \`.md\` (with a local \`./assets/\` folder) or save as a self-contained **\`.letra\`** archive to bundle your Markdown and assets into a single shippable file.

<p style="text-align: center; opacity: 0.72; margin-top: 2rem;">
  Crafted with <mark>Letra</mark> — start editing anywhere to make this document yours.
</p>
`;
