import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown pipeline', () => {
  it('renders GFM tables, checklists, headings, and metrics', () => {
    const md = `---
title: Spec Sheet
---

# Architecture

- [x] Ship Page Mode
- [ ] Polish icons

| Name | Size |
| --- | --- |
| Letter | 8.5x11 |
`;
    const res = renderMarkdown(md);
    expect(res.frontmatterTitle).toBe('Spec Sheet');
    expect(res.headings).toEqual([{ id: 'architecture', text: 'Architecture', level: 1 }]);
    expect(res.html).toContain('<table>');
    expect(res.html).toContain('type="checkbox"');
    expect(res.wordCount).toBeGreaterThan(5);
  });

  it('renders inline and display LaTeX including \\(...\\) and \\[...\\] without mutating inline code', () => {
    const md = 'Inline $E=mc^2$ and \\(a^2+b^2=c^2\\). Literal code `\\(...\\)` and `\\[...\\]` stay code.\n\n\\[\n\\int_0^1 x^2 dx = \\frac{1}{3}\n\\]';
    const res = renderMarkdown(md);
    expect(res.html).toContain('class="katex"');
    expect(res.html).toContain('class="katex-display"');
    expect(res.html).toContain('<code>\\(...\\)</code>');
    expect(res.html).toContain('<code>\\[...\\]</code>');
  });

  it('extracts Mermaid diagrams into hydrated placeholders', () => {
    const md = '```mermaid\nflowchart LR\nA["Raw"] --> B["Rendered"]\n```';
    const res = renderMarkdown(md);
    expect(res.html).toContain('letra-mermaid-block');
    expect(res.html).toContain(`data-mermaid-source="${encodeURIComponent('flowchart LR\nA["Raw"] --> B["Rendered"]')}"`);
  });

  it('transforms GitHub-style callouts and page breaks', () => {
    const md = `> [!TIP] Pro Move\n> Use Page Mode.\n\n<!-- pagebreak -->\n\n## Page Two`;
    const res = renderMarkdown(md);
    expect(res.html).toContain('letra-callout-tip');
    expect(res.html).toContain('Pro Move');
    expect(res.html).toContain('data-page-break="true"');
  });

  it('allows safe Markdown HTML while stripping XSS scripts', () => {
    const md = `<details open><summary>Info</summary><kbd>⌘S</kbd><mark>Saved</mark></details>\n\n<script>alert(1)</script><img src="x" onerror="alert(2)" />`;
    const res = renderMarkdown(md);
    expect(res.html).toContain('<details');
    expect(res.html).toContain('<kbd>');
    expect(res.html).toContain('<mark>');
    expect(res.html).not.toContain('<script>');
    expect(res.html).not.toContain('onerror');
  });

  it('rewrites local relative asset URLs to letra-asset protocol when documentPath is set', () => {
    const md = `![Chart](./assets/chart.png)`;
    const res = renderMarkdown(md, { documentPath: '/Users/demo/docs/report.md' });
    expect(res.html).toContain('letra-asset://local?');
    expect(res.html).toContain(encodeURIComponent('./assets/chart.png'));
  });
});
