import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Базовые стили редактора в стиле Basalt Dark (глубокий тёмный сланцевый оттенок)
export const basaltEditorTheme = EditorView.theme(
  {
    '&': {
      color: '#e2e8f0',
      backgroundColor: '#11141b',
      height: '100%',
      fontSize: '15.5px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      lineHeight: '1.7',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'inherit',
      padding: '24px 32px',
    },
    '.cm-content': {
      caretColor: '#38bdf8',
      maxWidth: '860px',
      margin: '0 auto',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#38bdf8',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(56, 189, 248, 0.22) !important',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(56, 189, 248, 0.15)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '4px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#94a3b8',
    },
    '.cm-gutters': {
      backgroundColor: '#11141b',
      color: '#475569',
      border: 'none',
      borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      paddingRight: '12px',
      userSelect: 'none',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      fontSize: '12px',
      minWidth: '28px',
      textAlign: 'right',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
  },
  { dark: true }
);

// Подсветка элементов синтаксиса Markdown
export const basaltHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, color: '#f8fafc', fontWeight: '700', fontSize: '1.55em' },
  { tag: t.heading2, color: '#38bdf8', fontWeight: '650', fontSize: '1.35em' },
  { tag: t.heading3, color: '#7dd3fc', fontWeight: '600', fontSize: '1.2em' },
  { tag: t.heading4, color: '#bae6fd', fontWeight: '600' },
  { tag: t.heading5, color: '#e0f2fe', fontWeight: '600' },
  { tag: t.heading6, color: '#e2e8f0', fontWeight: '600' },
  { tag: t.strong, fontWeight: '700', color: '#f1f5f9' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#e2e8f0' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#64748b' },
  { tag: t.keyword, color: '#c084fc' },
  { tag: t.atom, color: '#f472b6' },
  { tag: t.bool, color: '#f59e0b' },
  { tag: t.url, color: '#38bdf8', textDecoration: 'underline' },
  { tag: t.link, color: '#38bdf8', textDecoration: 'underline' },
  { tag: t.labelName, color: '#a78bfa' },
  { tag: t.list, color: '#38bdf8', fontWeight: '600' },
  { tag: t.quote, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.monospace, color: '#34d399', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.92em' },
  { tag: t.meta, color: '#64748b' },
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
]);

export const basaltTheme: Extension = [
  basaltEditorTheme,
  syntaxHighlighting(basaltHighlightStyle),
];
