import { EditorView, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { basaltTheme } from './theme';

export interface EditorCallbacks {
  onChange?: (content: string) => void;
  onStatsChange?: (stats: EditorStats) => void;
}

export interface EditorStats {
  words: number;
  chars: number;
  lines: number;
}

export class BasaltEditor {
  private view: EditorView | null = null;
  private changeTimeout: number | null = null;
  private container: HTMLElement;
  private callbacks: EditorCallbacks;

  constructor(
    container: HTMLElement,
    callbacks: EditorCallbacks = {}
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown(),
      basaltTheme,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString();
          this.handleDocChange(content);
          this.updateStats(content);
        }
      }),
    ];

    const state = EditorState.create({
      doc: '# Добро пожаловать в Basalt\n\nЭто ваша первая заметка на базе Markdown. Нажмите **«Открыть папку»** в левой панели, чтобы подключить локальное хранилище заметок.\n\n### Возможности прототипа:\n- 🚀 Мгновенная работа в браузере через File System Access API\n- 📝 Чистый нативный Markdown (CodeMirror 6)\n- 💾 Автоматическое сохранение правок на ваш диск\n- 🔒 100% приватность — файлы остаются только на вашем ПК\n',
      extensions,
    });

    this.view = new EditorView({
      state,
      parent: this.container,
    });

    this.updateStats(this.getContent());
  }

  private handleDocChange(content: string) {
    if (this.changeTimeout !== null) {
      window.clearTimeout(this.changeTimeout);
    }

    // Троттлинг автосохранения на 400мс
    this.changeTimeout = window.setTimeout(() => {
      if (this.callbacks.onChange) {
        this.callbacks.onChange(content);
      }
    }, 400);
  }

  private updateStats(content: string) {
    if (!this.callbacks.onStatsChange) return;

    const chars = content.length;
    const words = content.trim().length > 0 ? content.trim().split(/\s+/).length : 0;
    const lines = this.view ? this.view.state.doc.lines : 1;

    this.callbacks.onStatsChange({ words, chars, lines });
  }

  setContent(text: string) {
    if (!this.view) return;

    const currentDoc = this.view.state.doc.toString();
    if (currentDoc === text) return;

    this.view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: text },
    });

    this.updateStats(text);
  }

  getContent(): string {
    return this.view ? this.view.state.doc.toString() : '';
  }

  focus() {
    if (this.view) {
      this.view.focus();
    }
  }

  destroy() {
    if (this.changeTimeout !== null) {
      window.clearTimeout(this.changeTimeout);
    }
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }
}
