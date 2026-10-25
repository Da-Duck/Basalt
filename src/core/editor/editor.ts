import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  keymap,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { basaltTheme } from './theme';
import { SlashMenu } from './slashMenu';

export interface EditorCallbacks {
  onChange?: (content: string) => void;
  onStatsChange?: (stats: EditorStats) => void;
  onManualSave?: () => void;
  onToggleMode?: () => void;
  onInternalLinkClick?: (target: string) => void;
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
  private slashMenu: SlashMenu | null = null;

  constructor(
    container: HTMLElement,
    callbacks: EditorCallbacks = {}
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    const customKeymaps = [
      {
        key: 'Mod-s',
        run: () => {
          if (this.callbacks.onManualSave) {
            this.callbacks.onManualSave();
          }
          return true;
        },
      },
      {
        key: 'Mod-e',
        run: () => {
          if (this.callbacks.onToggleMode) {
            this.callbacks.onToggleMode();
          }
          return true;
        },
      },
      {
        key: 'Mod-z',
        run: undo,
        preventDefault: true,
      },
      {
        key: 'Mod-Shift-z',
        run: redo,
        preventDefault: true,
      },
      {
        key: 'Mod-y',
        run: redo,
        preventDefault: true,
      },
    ];

    const domHandlers = EditorView.domEventHandlers({
      keydown: (event, view) => {
        // Перехват навигации и выполнения в слэш-меню Notion
        if (this.slashMenu && this.slashMenu.isOpen()) {
          if (this.slashMenu.handleKeyDown(event)) {
            return true;
          }
        }

        const isMod = event.ctrlKey || event.metaKey;
        if (!isMod) return false;

        const keyLower = event.key.toLowerCase();
        const isZ = keyLower === 'z' || event.code === 'KeyZ' || keyLower === 'я';
        const isY = keyLower === 'y' || event.code === 'KeyY' || keyLower === 'н';

        // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
        if (event.shiftKey && isZ) {
          event.preventDefault();
          return redo(view);
        }

        // Redo: Ctrl+Y / Cmd+Y
        if (!event.shiftKey && isY) {
          event.preventDefault();
          return redo(view);
        }

        // Undo: Ctrl+Z / Cmd+Z
        if (!event.shiftKey && isZ) {
          event.preventDefault();
          return undo(view);
        }

        return false;
      },
      click: (event, view) => {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;

        const line = view.state.doc.lineAt(pos);
        const lineText = line.text;
        const col = pos - line.from;

        // Поиск WikiLinks: [[Target]] или [[Target|Label]]
        const wikiRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
        let match;
        while ((match = wikiRegex.exec(lineText)) !== null) {
          if (col >= match.index && col <= match.index + match[0].length) {
            const target = match[1].trim();
            if (this.callbacks.onInternalLinkClick) {
              this.callbacks.onInternalLinkClick(target);
              event.preventDefault();
              return true;
            }
          }
        }

        // Поиск обычных ссылок [Label](Url) при нажатом Ctrl / Cmd
        const mdLinkRegex = /\[(.*?)\]\((.*?)\)/g;
        while ((match = mdLinkRegex.exec(lineText)) !== null) {
          if (col >= match.index && col <= match.index + match[0].length) {
            const url = match[2].trim();
            if (/^(https?:\/\/)/i.test(url)) {
              if (event.ctrlKey || event.metaKey) {
                window.open(url, '_blank', 'noopener,noreferrer');
                event.preventDefault();
                return true;
              }
            } else {
              // Внутренняя ссылка
              if (this.callbacks.onInternalLinkClick) {
                this.callbacks.onInternalLinkClick(url);
                event.preventDefault();
                return true;
              }
            }
          }
        }

        return false;
      },
    });

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      EditorView.lineWrapping,
      markdown(),
      basaltTheme,
      keymap.of([...customKeymaps, ...defaultKeymap, ...historyKeymap]),
      domHandlers,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString();
          this.handleDocChange(content);
          this.updateStats(content);
        }
        if (this.slashMenu && this.view) {
          this.slashMenu.handleEditorUpdate(update, this.view);
        }
      }),
    ];

    const state = EditorState.create({
      doc: '# Добро пожаловать в Basalt\n\nЭто ваша первая заметка на базе Markdown.\n\n### Возможности:\n- Мгновенная работа в браузере через File System Access API\n- Чистый нативный Markdown без закрытых баз данных\n- Автоматическое сохранение правок на ваш диск\n- Ссылки на другие заметки через `[[Название заметки]]`\n- Меню быстрых блоков по нажатию `/` (как в Notion)\n',
      extensions,
    });

    this.view = new EditorView({
      state,
      parent: this.container,
    });

    this.slashMenu = new SlashMenu(this);

    this.updateStats(this.getContent());
  }

  private handleDocChange(content: string) {
    if (this.changeTimeout !== null) {
      window.clearTimeout(this.changeTimeout);
    }

    // Троттлинг автосохранения на 300мс
    this.changeTimeout = window.setTimeout(() => {
      if (this.callbacks.onChange) {
        this.callbacks.onChange(content);
      }
    }, 300);
  }

  private updateStats(content: string) {
    if (!this.callbacks.onStatsChange) return;

    const chars = content.length;
    const words = content.trim().length > 0 ? content.trim().split(/\s+/).length : 0;
    const lines = this.view ? this.view.state.doc.lines : 1;

    this.callbacks.onStatsChange({ words, chars, lines });
  }

  /**
   * Интерактивное переключение чекбокса задачи в документе по номеру строки
   */
  toggleCheckboxLine(lineIndex: number, checked: boolean) {
    if (!this.view) return;
    const doc = this.view.state.doc;
    if (lineIndex < 0 || lineIndex >= doc.lines) return;

    const line = doc.line(lineIndex + 1); // В CodeMirror нумерация строк с 1
    const lineText = line.text;
    const from = line.from;
    const to = line.to;

    let updatedText = lineText;
    if (checked) {
      updatedText = lineText.replace(/^(\s*[-*+]\s+\[)[ ](\])/, '$1x$2');
    } else {
      updatedText = lineText.replace(/^(\s*[-*+]\s+\[)[xX](\])/, '$1 $2');
    }

    if (updatedText !== lineText) {
      this.view.dispatch({
        changes: { from, to, insert: updatedText },
      });
      const newContent = this.view.state.doc.toString();
      this.callbacks.onChange?.(newContent);
      this.updateStats(newContent);
    }
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

  /**
   * Замена диапазона текста (например, /команда) на сниппет разметки
   * с перемещением курсора на заданную позицию
   */
  dispatchSnippet(from: number, to: number, snippet: string, cursorOffset: number = snippet.length) {
    if (!this.view) return;

    this.view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + cursorOffset },
      scrollIntoView: true,
    });
    this.view.focus();
  }

  destroy() {
    if (this.changeTimeout !== null) {
      window.clearTimeout(this.changeTimeout);
    }
    if (this.slashMenu) {
      this.slashMenu.destroy();
      this.slashMenu = null;
    }
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }
}
