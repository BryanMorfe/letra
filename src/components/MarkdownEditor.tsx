import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { openSearchPanel, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import {
  Bold,
  Code2,
  GitBranch,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  ListChecks,
  MessageSquareQuote,
  Scissors,
  Sigma,
  Table2,
} from 'lucide-react';
import type { ResolvedTheme } from '../../shared/types';

export interface MarkdownEditorHandle {
  insertSnippet: (snippet: string, cursorOffsetFromEnd?: number) => void;
  wrapSelection: (before: string, after?: string, fallbackText?: string) => void;
  openSearch: () => void;
  scrollToRatio: (ratio: number) => void;
  focus: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: ResolvedTheme;
  fontSizePx: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  onImportFiles: (files: File[]) => Promise<void>;
  onTriggerImportDialog: () => void;
  onScrollRatio?: (ratio: number) => void;
}

const lightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.28em', color: '#111827' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.16em', color: '#111827' },
  { tag: tags.heading3, fontWeight: '650', fontSize: '1.06em', color: '#1f2937' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: '#374151' },
  { tag: tags.strong, fontWeight: '650', color: '#111827' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#374151' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#6b7280' },
  { tag: tags.monospace, color: '#4338ca', backgroundColor: 'rgba(79,70,229,0.06)', borderRadius: '3px' },
  { tag: tags.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: tags.url, color: '#6366f1' },
  { tag: tags.quote, color: '#4b5563', fontStyle: 'italic' },
  { tag: [tags.meta, tags.processingInstruction], color: '#9ca3af' },
  { tag: tags.keyword, color: '#be123c' },
  { tag: tags.string, color: '#047857' },
  { tag: tags.number, color: '#b45309' },
  { tag: tags.comment, color: '#9ca3af', fontStyle: 'italic' },
  { tag: tags.tagName, color: '#0369a1' },
  { tag: tags.attributeName, color: '#7c3aed' },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.28em', color: '#f3f4f6' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.16em', color: '#f3f4f6' },
  { tag: tags.heading3, fontWeight: '650', fontSize: '1.06em', color: '#e5e7eb' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: '#d1d5db' },
  { tag: tags.strong, fontWeight: '650', color: '#f9fafb' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#d1d5db' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#6b7280' },
  { tag: tags.monospace, color: '#a5b4fc', backgroundColor: 'rgba(129,140,248,0.12)', borderRadius: '3px' },
  { tag: tags.link, color: '#93c5fd', textDecoration: 'underline' },
  { tag: tags.url, color: '#818cf8' },
  { tag: tags.quote, color: '#9ca3af', fontStyle: 'italic' },
  { tag: [tags.meta, tags.processingInstruction], color: '#64748b' },
  { tag: tags.keyword, color: '#f472b6' },
  { tag: tags.string, color: '#6ee7b7' },
  { tag: tags.number, color: '#fbbf24' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.tagName, color: '#7dd3fc' },
  { tag: tags.attributeName, color: '#c4b5fd' },
]);

function buildEditorTheme(theme: ResolvedTheme, fontSizePx: number) {
  const isDark = theme === 'dark';
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: `${fontSizePx}px`,
        backgroundColor: isDark ? '#16181d' : '#ffffff',
        color: isDark ? '#e6e8ec' : '#1b1f24',
      },
      '.cm-scroller': {
        fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, ui-monospace, monospace",
        lineHeight: '1.72',
        padding: '22px 0 64px 0',
        overflow: 'auto',
      },
      '.cm-content': {
        padding: '0 28px 0 18px',
        maxWidth: '860px',
        caretColor: isDark ? '#818cf8' : '#4f46e5',
      },
      '.cm-gutters': {
        backgroundColor: isDark ? '#16181d' : '#ffffff',
        color: isDark ? '#4d5565' : '#b2b9c5',
        border: 'none',
        paddingLeft: '12px',
        paddingRight: '8px',
        userSelect: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: isDark ? '#9aa2b1' : '#57606a',
      },
      '.cm-activeLine': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.028)' : 'rgba(15, 23, 42, 0.024)',
      },
      '.cm-cursor': {
        borderLeftColor: isDark ? '#818cf8' : '#4f46e5',
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.30)' : 'rgba(79, 70, 229, 0.14)',
      },
      '.cm-selectionMatch': {
        backgroundColor: isDark ? 'rgba(250, 204, 21, 0.16)' : 'rgba(250, 204, 21, 0.28)',
        borderRadius: '2px',
      },
      '.cm-panels': {
        backgroundColor: isDark ? '#1c1f26' : '#f7f8fa',
        color: isDark ? '#e6e8ec' : '#1f2328',
        borderBottom: `1px solid ${isDark ? '#2a2f3a' : '#e4e7ec'}`,
      },
      '.cm-search input': {
        backgroundColor: isDark ? '#12141a' : '#ffffff',
        color: isDark ? '#e6e8ec' : '#1f2328',
        border: `1px solid ${isDark ? '#2f3542' : '#d5d9e0'}`,
        borderRadius: '6px',
        padding: '3px 8px',
        outline: 'none',
      },
      '.cm-search button': {
        backgroundImage: 'none',
        backgroundColor: isDark ? '#252934' : '#ffffff',
        color: isDark ? '#d8dce5' : '#374151',
        border: `1px solid ${isDark ? '#323846' : '#d5d9e0'}`,
        borderRadius: '6px',
        padding: '2px 8px',
        cursor: 'pointer',
      },
      '.cm-placeholder': {
        color: isDark ? '#545c6e' : '#9ca3af',
        fontStyle: 'italic',
      },
    },
    { dark: isDark }
  );
}

export const MarkdownEditor = React.forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    {
      value,
      onChange,
      theme,
      fontSizePx,
      showLineNumbers,
      wordWrap,
      onImportFiles,
      onTriggerImportDialog,
      onScrollRatio,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onImportFilesRef = useRef(onImportFiles);
    const onScrollRatioRef = useRef(onScrollRatio);
    const isSyncingScrollRef = useRef(false);
    const [isDragOver, setIsDragOver] = useState(false);

    onChangeRef.current = onChange;
    onImportFilesRef.current = onImportFiles;
    onScrollRatioRef.current = onScrollRatio;

    const themeCompartment = useRef(new Compartment());
    const highlightCompartment = useRef(new Compartment());
    const lineNumCompartment = useRef(new Compartment());
    const wrapCompartment = useRef(new Compartment());

    useEffect(() => {
      if (!containerRef.current) return;

      const state = EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          bracketMatching(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          placeholder('Start writing in Markdown, LaTeX ($...$), Mermaid diagrams, or HTML…'),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          themeCompartment.current.of(buildEditorTheme(theme, fontSizePx)),
          highlightCompartment.current.of(
            syntaxHighlighting(theme === 'dark' ? darkHighlight : lightHighlight)
          ),
          lineNumCompartment.current.of(
            showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
          ),
          wrapCompartment.current.of(wordWrap ? EditorView.lineWrapping : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            paste(event) {
              const items = Array.from(event.clipboardData?.items || []);
              const assetFiles: File[] = [];
              for (const item of items) {
                if (item.kind === 'file') {
                  const file = item.getAsFile();
                  if (file) assetFiles.push(file);
                }
              }
              if (assetFiles.length > 0) {
                event.preventDefault();
                onImportFilesRef.current(assetFiles);
                return true;
              }
              return false;
            },
            scroll(_event, view) {
              if (isSyncingScrollRef.current) return;
              const scroller = view.scrollDOM;
              const maxScroll = scroller.scrollHeight - scroller.clientHeight;
              if (maxScroll > 0 && onScrollRatioRef.current) {
                onScrollRatioRef.current(scroller.scrollTop / maxScroll);
              }
            },
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync external value changes (e.g., switching tabs or opening files)
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current !== value) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
        });
      }
    }, [value]);

    // Update theme & font size dynamically
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: [
          themeCompartment.current.reconfigure(buildEditorTheme(theme, fontSizePx)),
          highlightCompartment.current.reconfigure(
            syntaxHighlighting(theme === 'dark' ? darkHighlight : lightHighlight)
          ),
        ],
      });
    }, [theme, fontSizePx]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: lineNumCompartment.current.reconfigure(
          showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
        ),
      });
    }, [showLineNumbers]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: wrapCompartment.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
      });
    }, [wordWrap]);

    const insertSnippet = (snippet: string, cursorOffsetFromEnd = 0) => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const pos = from + snippet.length - cursorOffsetFromEnd;
      view.dispatch({
        changes: { from, to, insert: snippet },
        selection: { anchor: Math.max(from, pos) },
      });
      view.focus();
    };

    const wrapSelection = (before: string, after = before, fallbackText = '') => {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const selected = view.state.sliceDoc(from, to) || fallbackText;
      const inserted = `${before}${selected}${after}`;
      view.dispatch({
        changes: { from, to, insert: inserted },
        selection: {
          anchor: from + before.length,
          head: from + before.length + selected.length,
        },
      });
      view.focus();
    };

    useImperativeHandle(ref, () => ({
      insertSnippet,
      wrapSelection,
      openSearch: () => {
        if (viewRef.current) {
          openSearchPanel(viewRef.current);
          viewRef.current.focus();
        }
      },
      scrollToRatio: (ratio: number) => {
        const view = viewRef.current;
        if (!view) return;
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        if (maxScroll <= 0) return;
        isSyncingScrollRef.current = true;
        scroller.scrollTop = ratio * maxScroll;
        requestAnimationFrame(() => {
          isSyncingScrollRef.current = false;
        });
      },
      focus: () => viewRef.current?.focus(),
    }));

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) {
        await onImportFiles(files);
      }
    };

    const toolbarItems: Array<{
      label: string;
      icon: React.ReactNode;
      action: () => void;
      dividerAfter?: boolean;
    }> = [
      { label: 'Heading', icon: <Heading2 className="w-3.5 h-3.5" />, action: () => insertSnippet('\n## Heading\n', 1) },
      { label: 'Bold', icon: <Bold className="w-3.5 h-3.5" />, action: () => wrapSelection('**', '**', 'bold text') },
      { label: 'Italic', icon: <Italic className="w-3.5 h-3.5" />, action: () => wrapSelection('*', '*', 'italic') },
      { label: 'Code', icon: <Code2 className="w-3.5 h-3.5" />, action: () => wrapSelection('`', '`', 'code'), dividerAfter: true },
      { label: 'Link', icon: <Link2 className="w-3.5 h-3.5" />, action: () => wrapSelection('[', '](https://)', 'link text') },
      { label: 'Checklist', icon: <ListChecks className="w-3.5 h-3.5" />, action: () => insertSnippet('\n- [ ] Task item\n', 1) },
      { label: 'Callout', icon: <MessageSquareQuote className="w-3.5 h-3.5" />, action: () => insertSnippet('\n> [!NOTE]\n> Callout details here.\n', 1) },
      {
        label: 'Table',
        icon: <Table2 className="w-3.5 h-3.5" />,
        action: () =>
          insertSnippet(
            '\n| Column A | Column B | Column C |\n| :--- | :--- | :--- |\n| Value 1 | Value 2 | Value 3 |\n',
            1
          ),
        dividerAfter: true,
      },
      {
        label: 'LaTeX Equation',
        icon: <Sigma className="w-3.5 h-3.5" />,
        action: () => insertSnippet('\n$$\nE = mc^2\n$$\n', 4),
      },
      {
        label: 'Mermaid Diagram',
        icon: <GitBranch className="w-3.5 h-3.5" />,
        action: () =>
          insertSnippet(
            '\n```mermaid\nflowchart LR\n    A[Start] --> B[Process] --> C[Done]\n```\n',
            5
          ),
      },
      {
        label: 'Page Break',
        icon: <Scissors className="w-3.5 h-3.5" />,
        action: () => insertSnippet('\n<!-- pagebreak -->\n\n', 0),
        dividerAfter: true,
      },
      {
        label: 'Import Image or Asset',
        icon: <ImagePlus className="w-3.5 h-3.5" />,
        action: onTriggerImportDialog,
      },
    ];

    return (
      <div
        className="relative flex flex-col h-full w-full overflow-hidden bg-[var(--letra-editor-bg)]"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
          }
        }}
        onDrop={handleDrop}
      >
        {/* Subtle Editorial Formatting Micro-Bar */}
        <div className="flex items-center gap-0.5 px-3 h-9 shrink-0 border-b border-[var(--letra-border)] bg-[var(--letra-surface)]/70 backdrop-blur-sm overflow-x-auto no-scrollbar">
          {toolbarItems.map((item) => (
            <React.Fragment key={item.label}>
              <button
                type="button"
                title={item.label}
                onClick={item.action}
                className="p-1.5 rounded-md text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] transition-colors cursor-pointer shrink-0"
              >
                {item.icon}
              </button>
              {item.dividerAfter && (
                <div className="w-px h-4 mx-1 bg-[var(--letra-border)] shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* CodeMirror Host */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />

        {/* Drag-and-Drop Asset Overlay */}
        {isDragOver && (
          <div className="absolute inset-3 z-30 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-500 bg-indigo-500/10 backdrop-blur-xs pointer-events-none">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-[var(--letra-surface)] shadow-lg border border-[var(--letra-border)]">
              <ImagePlus className="w-5 h-5 text-indigo-500" />
              <span className="text-sm font-medium text-[var(--letra-fg)]">
                Drop images or assets to insert into document
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

MarkdownEditor.displayName = 'MarkdownEditor';
