import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Базовые стили редактора (полностью адаптивные к темам через CSS-переменные)
export const basaltEditorTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--text-main)',
      backgroundColor: 'var(--bg-main)',
      height: '100%',
      fontSize: '15.5px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      lineHeight: '1.7',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'inherit',
      padding: '24px 32px',
      backgroundColor: 'var(--bg-main)',
    },
    '.cm-content': {
      caretColor: 'var(--accent)',
      maxWidth: '860px',
      margin: '0 auto',
      color: 'var(--text-main)',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: 'var(--accent)',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--accent-subtle) !important',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'var(--accent-subtle)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--bg-card-hover)',
      borderRadius: '4px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--accent)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-muted)',
      border: 'none',
      borderRight: '1px solid var(--border-color)',
      paddingRight: '12px',
      userSelect: 'none',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      fontSize: '12px',
      minWidth: '28px',
      textAlign: 'right',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      color: 'var(--text-muted)',
    },
  }
);

// Подсветка элементов синтаксиса Markdown с адаптацией к светлой/тёмной теме через CSS-переменные
export const basaltHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, color: 'var(--text-main)', fontWeight: '700', fontSize: '1.55em' },
  { tag: t.heading2, color: 'var(--accent)', fontWeight: '650', fontSize: '1.35em' },
  { tag: t.heading3, color: 'var(--accent)', fontWeight: '600', fontSize: '1.2em' },
  { tag: t.heading4, color: 'var(--accent)', fontWeight: '600' },
  { tag: t.heading5, color: 'var(--accent)', fontWeight: '600' },
  { tag: t.heading6, color: 'var(--text-main)', fontWeight: '600' },
  { tag: t.strong, fontWeight: '700', color: 'var(--text-main)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--text-secondary)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.keyword, color: 'var(--accent)' },
  { tag: t.atom, color: 'var(--accent)' },
  { tag: t.bool, color: 'var(--accent)' },
  { tag: t.url, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: t.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: t.labelName, color: 'var(--accent)' },
  { tag: t.list, color: 'var(--accent)', fontWeight: '600' },
  { tag: t.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: t.monospace, color: 'var(--accent)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.92em' },
  { tag: t.meta, color: 'var(--text-muted)' },
  { tag: t.comment, color: 'var(--text-muted)', fontStyle: 'italic' },
]);

export const basaltTheme: Extension = [
  basaltEditorTheme,
  syntaxHighlighting(basaltHighlightStyle),
];
