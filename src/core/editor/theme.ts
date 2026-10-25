import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Базовые стили редактора в стиле Basalt Ochre Dark (глубокий сланцевый фон с тёплым охровым акцентом)
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
      caretColor: '#e5a93c',
      maxWidth: '860px',
      margin: '0 auto',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#e5a93c',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(229, 169, 60, 0.24) !important',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(229, 169, 60, 0.16)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '4px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: '#e5a93c',
    },
    '.cm-gutters': {
      backgroundColor: '#11141b',
      color: '#52525b',
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

// Подсветка элементов синтаксиса Markdown с охровыми акцентами
export const basaltHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, color: '#f8fafc', fontWeight: '700', fontSize: '1.55em' },
  { tag: t.heading2, color: '#e5a93c', fontWeight: '650', fontSize: '1.35em' },
  { tag: t.heading3, color: '#f5c366', fontWeight: '600', fontSize: '1.2em' },
  { tag: t.heading4, color: '#fde68a', fontWeight: '600' },
  { tag: t.heading5, color: '#fef3c7', fontWeight: '600' },
  { tag: t.heading6, color: '#e2e8f0', fontWeight: '600' },
  { tag: t.strong, fontWeight: '700', color: '#fef08a' },
  { tag: t.emphasis, fontStyle: 'italic', color: '#e2e8f0' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: '#71717a' },
  { tag: t.keyword, color: '#f59e0b' },
  { tag: t.atom, color: '#fb923c' },
  { tag: t.bool, color: '#d97706' },
  { tag: t.url, color: '#e5a93c', textDecoration: 'underline' },
  { tag: t.link, color: '#e5a93c', textDecoration: 'underline' },
  { tag: t.labelName, color: '#fcd34d' },
  { tag: t.list, color: '#e5a93c', fontWeight: '600' },
  { tag: t.quote, color: '#a1a1aa', fontStyle: 'italic' },
  { tag: t.monospace, color: '#fcd34d', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.92em' },
  { tag: t.meta, color: '#71717a' },
  { tag: t.comment, color: '#71717a', fontStyle: 'italic' },
]);

export const basaltTheme: Extension = [
  basaltEditorTheme,
  syntaxHighlighting(basaltHighlightStyle),
];
