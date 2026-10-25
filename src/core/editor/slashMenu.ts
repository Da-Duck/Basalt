import type { EditorView, ViewUpdate } from '@codemirror/view';
import { t } from '../i18n/i18n';
import type { BasaltEditor } from './editor';

export interface SlashCommand {
  id: string;
  category: 'basic' | 'callouts' | 'advanced' | 'inserts';
  titleKey: Parameters<typeof t>[0];
  descKey: Parameters<typeof t>[0];
  keywords: string[];
  iconSvg: string;
  badge?: string;
  execute: (editor: BasaltEditor, from: number, to: number) => void;
}

export class SlashMenu {
  private editor: BasaltEditor;
  private menuEl: HTMLElement;
  private listEl: HTMLElement;
  private isOpenState = false;
  private triggerFrom = 0;
  private triggerTo = 0;
  private currentQuery = '';
  private selectedIndex = 0;
  private filteredCommands: SlashCommand[] = [];

  constructor(editor: BasaltEditor) {
    this.editor = editor;

    this.menuEl = document.createElement('div');
    this.menuEl.className = 'basalt-slash-menu';
    this.menuEl.style.display = 'none';

    this.listEl = document.createElement('div');
    this.listEl.className = 'slash-menu-list';
    this.menuEl.appendChild(this.listEl);

    document.body.appendChild(this.menuEl);

    document.addEventListener('mousedown', this.handleOutsideClick, true);
    window.addEventListener('resize', this.handleWindowResize);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (!this.isOpenState) return;
    if (!this.menuEl.contains(e.target as Node)) {
      this.close();
    }
  };

  private handleWindowResize = () => {
    if (this.isOpenState) {
      this.close();
    }
  };

  public isOpen(): boolean {
    return this.isOpenState;
  }

  private getCommands(): SlashCommand[] {
    return [
      // 1. Базовые блоки
      {
        id: 'heading-1',
        category: 'basic',
        titleKey: 'slashHeading1',
        descKey: 'slashHeading1Desc',
        keywords: ['h1', 'heading', 'header', 'заголовок', 'раздел', '1'],
        badge: '#',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12M12 6v12M4 12h8"/><text x="14" y="16" font-size="10" font-family="sans-serif" font-weight="bold" fill="currentColor" stroke="none">1</text></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '# ', 2);
        },
      },
      {
        id: 'heading-2',
        category: 'basic',
        titleKey: 'slashHeading2',
        descKey: 'slashHeading2Desc',
        keywords: ['h2', 'heading', 'header', 'подзаголовок', '2'],
        badge: '##',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12M12 6v12M4 12h8"/><text x="14" y="16" font-size="10" font-family="sans-serif" font-weight="bold" fill="currentColor" stroke="none">2</text></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '## ', 3);
        },
      },
      {
        id: 'heading-3',
        category: 'basic',
        titleKey: 'slashHeading3',
        descKey: 'slashHeading3Desc',
        keywords: ['h3', 'heading', 'header', 'мелкий', '3'],
        badge: '###',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12M12 6v12M4 12h8"/><text x="14" y="16" font-size="10" font-family="sans-serif" font-weight="bold" fill="currentColor" stroke="none">3</text></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '### ', 4);
        },
      },
      {
        id: 'todo-list',
        category: 'basic',
        titleKey: 'slashTodoList',
        descKey: 'slashTodoListDesc',
        keywords: ['todo', 'task', 'check', 'чекбокс', 'задача', 'список', 'дело', 'пункт'],
        badge: '[]',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="9 12 11 14 15 10"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '- [ ] ', 6);
        },
      },
      {
        id: 'bullet-list',
        category: 'basic',
        titleKey: 'slashBulletList',
        descKey: 'slashBulletListDesc',
        keywords: ['bullet', 'list', 'ul', 'маркер', 'список', 'пункт', 'точка'],
        badge: '-',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '- ', 2);
        },
      },
      {
        id: 'numbered-list',
        category: 'basic',
        titleKey: 'slashNumberedList',
        descKey: 'slashNumberedListDesc',
        keywords: ['numbered', 'list', 'ol', 'номер', 'нумерация', 'число', 'порядок'],
        badge: '1.',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="7" font-weight="bold" fill="currentColor" stroke="none">1</text><text x="2" y="14" font-size="7" font-weight="bold" fill="currentColor" stroke="none">2</text><text x="2" y="20" font-size="7" font-weight="bold" fill="currentColor" stroke="none">3</text></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '1. ', 3);
        },
      },
      {
        id: 'quote',
        category: 'basic',
        titleKey: 'slashQuote',
        descKey: 'slashQuoteDesc',
        keywords: ['quote', 'blockquote', 'цитата', 'высказывание'],
        badge: '>',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '> ', 2);
        },
      },
      {
        id: 'divider',
        category: 'basic',
        titleKey: 'slashDivider',
        descKey: 'slashDividerDesc',
        keywords: ['divider', 'hr', 'line', 'separator', 'черта', 'линия', 'разделитель'],
        badge: '---',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '---\n\n', 5);
        },
      },

      // 2. Врезки и примечания (Callouts)
      {
        id: 'callout-note',
        category: 'callouts',
        titleKey: 'slashCalloutNote',
        descKey: 'slashCalloutNoteDesc',
        keywords: ['callout', 'note', 'info', 'врезка', 'примечание', 'инфо'],
        badge: '[!NOTE]',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '> [!NOTE]\n> ', 12);
        },
      },
      {
        id: 'callout-tip',
        category: 'callouts',
        titleKey: 'slashCalloutTip',
        descKey: 'slashCalloutTipDesc',
        keywords: ['callout', 'tip', 'hint', 'advice', 'врезка', 'совет', 'подсказка'],
        badge: '[!TIP]',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6m-4 3h2M12 2a7 7 0 0 0-4.5 12.38V16a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-1.62A7 7 0 0 0 12 2z"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '> [!TIP]\n> ', 11);
        },
      },
      {
        id: 'callout-warning',
        category: 'callouts',
        titleKey: 'slashCalloutWarning',
        descKey: 'slashCalloutWarningDesc',
        keywords: ['callout', 'warning', 'alert', 'врезка', 'внимание', 'предупреждение', 'опасно'],
        badge: '[!WARNING]',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '> [!WARNING]\n> ', 15);
        },
      },
      {
        id: 'callout-important',
        category: 'callouts',
        titleKey: 'slashCalloutImportant',
        descKey: 'slashCalloutImportantDesc',
        keywords: ['callout', 'important', 'crucial', 'врезка', 'важно', 'критично'],
        badge: '[!IMPORTANT]',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '> [!IMPORTANT]\n> ', 17);
        },
      },

      // 3. Специальные блоки
      {
        id: 'code-block',
        category: 'advanced',
        titleKey: 'slashCode',
        descKey: 'slashCodeDesc',
        keywords: ['code', 'block', 'snippet', 'syntax', 'код', 'скрипт', 'программа'],
        badge: '```',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '```\n\n```', 4);
        },
      },
      {
        id: 'table',
        category: 'advanced',
        titleKey: 'slashTable',
        descKey: 'slashTableDesc',
        keywords: ['table', 'grid', 'columns', 'rows', 'таблица', 'сетка', 'колонки'],
        badge: '|---|',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`,
        execute: (ed, from, to) => {
          const tableSnippet = '| Заголовок 1 | Заголовок 2 |\n| ----------- | ----------- |\n| Ячейка 1    | Ячейка 2    |\n';
          ed.dispatchSnippet(from, to, tableSnippet, 2);
        },
      },
      {
        id: 'wikilink',
        category: 'advanced',
        titleKey: 'slashLink',
        descKey: 'slashLinkDesc',
        keywords: ['wikilink', 'link', 'note', 'ссылка', 'заметка', 'переход'],
        badge: '[[]]',
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
        execute: (ed, from, to) => {
          ed.dispatchSnippet(from, to, '[[', 2);
        },
      },

      // 4. Вставки (Inserts)
      {
        id: 'insert-date',
        category: 'inserts',
        titleKey: 'slashDate',
        descKey: 'slashDateDesc',
        keywords: ['date', 'today', 'day', 'дата', 'сегодня', 'день'],
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        execute: (ed, from, to) => {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd} `;
          ed.dispatchSnippet(from, to, dateStr, dateStr.length);
        },
      },
      {
        id: 'insert-time',
        category: 'inserts',
        titleKey: 'slashTime',
        descKey: 'slashTimeDesc',
        keywords: ['time', 'now', 'clock', 'время', 'сейчас', 'часы'],
        iconSvg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        execute: (ed, from, to) => {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const timeStr = `${hh}:${mm} `;
          ed.dispatchSnippet(from, to, timeStr, timeStr.length);
        },
      },
    ];
  }

  public handleEditorUpdate(update: ViewUpdate, view: EditorView) {
    if (!view || (!update.docChanged && !update.selectionSet)) return;

    const sel = view.state.selection.main;
    if (!sel.empty) {
      if (this.isOpenState) this.close();
      return;
    }

    const pos = sel.head;
    const line = view.state.doc.lineAt(pos);
    const textBefore = line.text.slice(0, pos - line.from);

    // Соответствует символу / в начале строки (с пробелами) или после пробела
    const match = textBefore.match(/(?:^|(\s))\/([a-zA-Zа-яА-Я0-9_]*)$/);
    if (!match) {
      if (this.isOpenState) {
        this.close();
      }
      return;
    }

    const query = (match[2] || '').toLowerCase().trim();
    const fullMatch = match[0];
    const leadingSpaceLen = match[1] ? match[1].length : 0;
    const triggerLen = fullMatch.length - leadingSpaceLen;
    const from = pos - triggerLen;
    const to = pos;

    const coords = view.coordsAtPos(pos);
    this.open(from, to, query, coords);
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.isOpenState) return false;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectNext();
      return true;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectPrev();
      return true;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.executeSelected();
      return true;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return true;
    }

    return false;
  }

  private open(
    from: number,
    to: number,
    query: string,
    coords: { left: number; right: number; top: number; bottom: number } | null
  ) {
    this.triggerFrom = from;
    this.triggerTo = to;
    this.currentQuery = query;

    this.filterCommands(query);

    if (this.filteredCommands.length === 0) {
      this.renderEmpty();
    } else {
      if (this.selectedIndex >= this.filteredCommands.length) {
        this.selectedIndex = 0;
      }
      this.renderList();
    }

    this.positionMenu(coords);
    this.menuEl.style.display = 'block';
    this.isOpenState = true;
  }

  private filterCommands(query: string) {
    const all = this.getCommands();
    if (!query) {
      this.filteredCommands = all;
      return;
    }

    this.filteredCommands = all.filter((cmd) => {
      const title = t(cmd.titleKey).toLowerCase();
      const desc = t(cmd.descKey).toLowerCase();
      if (title.includes(query) || desc.includes(query)) return true;
      if (cmd.badge && cmd.badge.toLowerCase().includes(query)) return true;
      return cmd.keywords.some((kw) => kw.toLowerCase().includes(query));
    });
  }

  private positionMenu(coords: { left: number; right: number; top: number; bottom: number } | null) {
    if (!coords) return;

    const menuWidth = 320;
    const menuEstimatedHeight = Math.min(360, this.filteredCommands.length * 44 + 48);

    let left = coords.left;
    let top = coords.bottom + 6;

    // Ограничение по ширине экрана
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    // Если меню снизу вылезает за пределы экрана — открываем над курсором
    if (top + menuEstimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, coords.top - menuEstimatedHeight - 6);
    }

    this.menuEl.style.left = `${Math.round(left)}px`;
    this.menuEl.style.top = `${Math.round(top)}px`;
  }

  private renderList() {
    this.listEl.innerHTML = '';

    const categoryNames: Record<SlashCommand['category'], string> = {
      basic: t('slashCategoryBasic'),
      callouts: t('slashCategoryCallouts'),
      advanced: t('slashCategoryAdvanced'),
      inserts: t('slashCategoryInserts'),
    };

    let lastCategory: SlashCommand['category'] | null = null;

    this.filteredCommands.forEach((cmd, idx) => {
      // Заголовок категории (если не активен детальный поиск)
      if (!this.currentQuery && cmd.category !== lastCategory) {
        lastCategory = cmd.category;
        const catEl = document.createElement('div');
        catEl.className = 'slash-menu-category';
        catEl.textContent = categoryNames[cmd.category];
        this.listEl.appendChild(catEl);
      }

      const itemEl = document.createElement('div');
      itemEl.className = `slash-menu-item ${idx === this.selectedIndex ? 'is-selected' : ''}`;
      itemEl.dataset.index = String(idx);

      const iconWrap = document.createElement('div');
      iconWrap.className = 'slash-menu-icon';
      iconWrap.innerHTML = cmd.iconSvg;

      const infoWrap = document.createElement('div');
      infoWrap.className = 'slash-menu-info';

      const titleEl = document.createElement('div');
      titleEl.className = 'slash-menu-title';
      titleEl.textContent = t(cmd.titleKey);

      const descEl = document.createElement('div');
      descEl.className = 'slash-menu-desc';
      descEl.textContent = t(cmd.descKey);

      infoWrap.appendChild(titleEl);
      infoWrap.appendChild(descEl);

      itemEl.appendChild(iconWrap);
      itemEl.appendChild(infoWrap);

      if (cmd.badge) {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'slash-menu-badge';
        badgeEl.textContent = cmd.badge;
        itemEl.appendChild(badgeEl);
      }

      itemEl.addEventListener('mouseenter', () => {
        this.selectedIndex = idx;
        this.updateSelectionClasses();
      });

      itemEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.executeCommand(cmd);
      });

      this.listEl.appendChild(itemEl);
    });

    this.scrollToSelectedItem();
  }

  private renderEmpty() {
    this.listEl.innerHTML = `
      <div class="slash-menu-empty">
        <span class="slash-empty-text">${t('slashEmptyHint')}</span>
      </div>
    `;
  }

  private updateSelectionClasses() {
    const items = this.listEl.querySelectorAll('.slash-menu-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('is-selected');
      } else {
        item.classList.remove('is-selected');
      }
    });
  }

  private scrollToSelectedItem() {
    const selectedEl = this.listEl.querySelector(`.slash-menu-item[data-index="${this.selectedIndex}"]`) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  public selectNext() {
    if (this.filteredCommands.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
    this.updateSelectionClasses();
    this.scrollToSelectedItem();
  }

  public selectPrev() {
    if (this.filteredCommands.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
    this.updateSelectionClasses();
    this.scrollToSelectedItem();
  }

  public executeSelected() {
    if (this.filteredCommands.length === 0) return;
    const cmd = this.filteredCommands[this.selectedIndex];
    if (cmd) {
      this.executeCommand(cmd);
    }
  }

  private executeCommand(cmd: SlashCommand) {
    this.close();
    cmd.execute(this.editor, this.triggerFrom, this.triggerTo);
  }

  public close() {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    this.menuEl.style.display = 'none';
    this.currentQuery = '';
    this.selectedIndex = 0;
  }

  public destroy() {
    this.close();
    document.removeEventListener('mousedown', this.handleOutsideClick, true);
    window.removeEventListener('resize', this.handleWindowResize);
    if (this.menuEl.parentNode) {
      this.menuEl.parentNode.removeChild(this.menuEl);
    }
  }
}
