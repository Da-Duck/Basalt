import { WebFileAdapter } from './core/adapter/WebFileAdapter';
import type { FileEntry } from './core/adapter/FileSystemAdapter';
import { BasaltEditor, type EditorStats } from './core/editor/editor';
import {
  t,
  type Language,
  formatNotesCount,
  formatWordsCount,
  formatCharsCount,
} from './core/i18n/i18n';
import { settingsManager, type ThemePreset } from './core/settings/settings';
import { metadataManager } from './core/metadata/metadata';
import { FLATICON_SVGS, EMOJI_LIST, renderIconPreview } from './core/icons/icons';
import { getMarkdownGuideHtml } from './core/guide/markdownGuide';

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Map<string, TreeNode>;
  fileEntry?: FileEntry;
}

const NOTE_COLOR_PALETTE = [
  '#ef4444', // Красный
  '#f97316', // Оранжевый
  '#e5a93c', // Охровый
  '#eab308', // Желтый
  '#10b981', // Зеленый
  '#06b6d4', // Бирюзовый
  '#3b82f6', // Синий
  '#8b5cf6', // Фиолетовый
  '#ec4899', // Розовый
  '#f43f5e', // Малиновый
  '#ffffff', // Белый
  '#94a3b8', // Серый
];

class BasaltApp {
  private adapter = new WebFileAdapter();
  private editor: BasaltEditor | null = null;
  private currentFile: FileEntry | null = null;
  private selectedFolder: string = '';
  private collapsedFolders = new Set<string>();
  private allEntries: FileEntry[] = [];
  private searchQuery: string = '';
  private iconPickerTarget: { path: string; isDir: boolean } | null = null;
  private lastStats: EditorStats = { words: 0, chars: 0, lines: 0 };

  // DOM Элементы
  private btnOpenVault = document.getElementById('btn-open-vault') as HTMLButtonElement;
  private btnNewNote = document.getElementById('btn-new-note') as HTMLButtonElement;
  private btnNewFolder = document.getElementById('btn-new-folder') as HTMLButtonElement;
  private vaultTitle = document.getElementById('vault-title') as HTMLElement;
  private fileListContainer = document.getElementById('file-list') as HTMLElement;
  private filesCount = document.getElementById('files-count') as HTMLElement;
  private activeFileName = document.getElementById('active-file-name') as HTMLElement;
  private activeFileIcon = document.getElementById('active-file-icon') as HTMLElement;
  private saveBadge = document.getElementById('save-badge') as HTMLElement;
  private saveStatusText = document.getElementById('save-status-text') as HTMLElement;
  private statWords = document.getElementById('stat-words') as HTMLElement;
  private statChars = document.getElementById('stat-chars') as HTMLElement;
  private sidebar = document.getElementById('sidebar') as HTMLElement;
  private editorMount = document.getElementById('editor-mount') as HTMLElement;

  // Поиск, пространства, сворачивание
  private searchInput = document.getElementById('search-input') as HTMLInputElement;
  private btnClearSearch = document.getElementById('btn-clear-search') as HTMLButtonElement;
  private workspaceSelect = document.getElementById('workspace-select') as HTMLSelectElement;
  private btnCollapseSidebar = document.getElementById('btn-collapse-sidebar') as HTMLButtonElement;
  private btnExpandSidebar = document.getElementById('btn-expand-sidebar') as HTMLButtonElement;
  private btnToggleSidebar = document.getElementById('btn-toggle-sidebar') as HTMLButtonElement | null;

  // Модальные окна, корзина и справка
  private btnOpenTrash = document.getElementById('btn-open-trash') as HTMLButtonElement;
  private btnOpenSettings = document.getElementById('btn-open-settings') as HTMLButtonElement;
  private btnOpenInfo = document.getElementById('btn-open-info') as HTMLButtonElement;
  private trashBadgeCount = document.getElementById('trash-badge-count') as HTMLElement;
  private modalSettings = document.getElementById('modal-settings') as HTMLElement;
  private modalIconPicker = document.getElementById('modal-icon-picker') as HTMLElement;
  private modalTrash = document.getElementById('modal-trash') as HTMLElement;
  private modalInfo = document.getElementById('modal-info') as HTMLElement;
  private infoGuideContent = document.getElementById('info-guide-content') as HTMLElement;

  // Кнопка сохранения настроек
  private btnSaveSettings = document.getElementById('btn-save-settings') as HTMLButtonElement | null;

  // Настройки корзины и вкладки иконок
  private trashRetentionInput = document.getElementById('trash-retention-input') as HTMLInputElement;
  private tabBtnSvg = document.getElementById('tab-btn-svg') as HTMLButtonElement;
  private tabBtnEmoji = document.getElementById('tab-btn-emoji') as HTMLButtonElement;
  private panelSvgIcons = document.getElementById('panel-svg-icons') as HTMLElement;
  private panelEmojiIcons = document.getElementById('panel-emoji-icons') as HTMLElement;

  // Выбор цвета названия заметки
  private noteColorSection = document.getElementById('note-color-section') as HTMLElement | null;
  private noteColorSwatches = document.getElementById('note-color-swatches') as HTMLElement | null;
  private btnResetColor = document.getElementById('btn-reset-color') as HTMLButtonElement | null;

  constructor() {
    this.initEditor();
    this.bindEvents();
    this.bindModals();
    this.checkBrowserSupport();
    this.updateI18nLabels();
    this.updateTrashBadge();

    // Очистка корзины по сроку хранения
    metadataManager.purgeExpired(settingsManager.get().trashRetentionDays);
  }

  private checkBrowserSupport() {
    if (!this.adapter.isSupported()) {
      this.vaultTitle.textContent = t('browserNotSupported');
      this.btnOpenVault.disabled = true;
      this.btnOpenVault.title = t('browserNotSupportedDesc');
    }
  }

  private initEditor() {
    this.editor = new BasaltEditor(this.editorMount, {
      onChange: (content: string) => this.handleContentChange(content),
      onStatsChange: (stats: EditorStats) => this.handleStatsChange(stats),
    });
  }

  private bindEvents() {
    this.btnOpenVault.addEventListener('click', () => this.handleOpenVault());
    this.btnNewNote.addEventListener('click', () => this.handleCreateNewNote());
    this.btnNewFolder.addEventListener('click', () => this.handleCreateNewFolder());

    // Сворачивание и разворачивание боковой панели
    this.btnCollapseSidebar.addEventListener('click', () => {
      this.sidebar.classList.add('collapsed');
      this.btnExpandSidebar.classList.add('visible');
    });

    this.btnExpandSidebar.addEventListener('click', () => {
      this.sidebar.classList.remove('collapsed');
      this.btnExpandSidebar.classList.remove('visible');
    });

    this.btnToggleSidebar?.addEventListener('click', () => {
      this.sidebar.classList.toggle('open');
    });

    // Живой поиск
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value.trim().toLowerCase();
      this.btnClearSearch.style.display = this.searchQuery ? 'block' : 'none';
      this.renderFilteredTree();
    });

    this.btnClearSearch.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchQuery = '';
      this.btnClearSearch.style.display = 'none';
      this.renderFilteredTree();
    });

    // Переключение пространств
    this.workspaceSelect.addEventListener('change', () => {
      const val = this.workspaceSelect.value;
      if (val === '__new__') {
        this.handleCreateWorkspace();
      } else {
        settingsManager.save({ activeWorkspace: val });
        this.selectedFolder = val;
        this.renderFilteredTree();
      }
    });

    // Корзина, Настройки и Справка
    this.btnOpenTrash.addEventListener('click', () => this.openTrashModal());
    this.btnOpenSettings.addEventListener('click', () => this.openSettingsModal());
    this.btnOpenInfo.addEventListener('click', () => this.openInfoModal());
  }

  // ==========================================================================
  // МОДАЛЬНЫЕ ОКНА И НАСТРОЙКИ
  // ==========================================================================
  private bindModals() {
    // Закрытие модальных окон
    document.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const targetId = (e.currentTarget as HTMLElement).getAttribute('data-close');
        if (targetId) {
          const m = document.getElementById(targetId);
          if (m) m.style.display = 'none';
        }
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          (backdrop as HTMLElement).style.display = 'none';
        }
      });
    });

    // Темы: пресеты
    const chips = document.querySelectorAll('.preset-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');

        const preset = chip.getAttribute('data-preset') as ThemePreset;
        const customBox = document.getElementById('custom-colors-box');
        if (customBox) customBox.style.display = preset === 'custom' ? 'flex' : 'none';

        settingsManager.save({ themePreset: preset });
      });
    });

    // Своя палитра
    const pickerBg = document.getElementById('picker-bg-color') as HTMLInputElement;
    const pickerAccent = document.getElementById('picker-accent-color') as HTMLInputElement;

    const onCustomColorChange = () => {
      settingsManager.save({
        themePreset: 'custom',
        customBg: pickerBg.value,
        customAccent: pickerAccent.value,
      });
    };

    pickerBg.addEventListener('input', onCustomColorChange);
    pickerAccent.addEventListener('input', onCustomColorChange);

    // Смена языка
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        langBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const lang = btn.getAttribute('data-lang') as Language;
        settingsManager.save({ language: lang });
        this.updateI18nLabels();
        this.renderFilteredTree();
        this.updateWorkspacesDropdown();
        this.handleStatsChange(this.lastStats);
        if (this.modalInfo.style.display !== 'none') {
          this.openInfoModal();
        }
      });
    });

    // Срок хранения в корзине: ручной ввод числа
    if (this.trashRetentionInput) {
      this.trashRetentionInput.addEventListener('input', () => {
        const rawVal = parseInt(this.trashRetentionInput.value, 10);
        const days = isNaN(rawVal) || rawVal < 0 ? 0 : rawVal;
        settingsManager.save({ trashRetentionDays: days });
        const hint = document.getElementById('trash-retention-unit-hint');
        if (hint) {
          hint.textContent = days === 0 ? t('infinity') : t('daysUnit');
        }
      });
    }

    // Кнопка подтверждения настроек: надежно применяет все параметры без перезагрузки страницы
    this.btnSaveSettings?.addEventListener('click', () => {
      const activeLangBtn = document.querySelector('.lang-btn.active');
      const lang = (activeLangBtn?.getAttribute('data-lang') as Language) || settingsManager.get().language;
      const rawRetention = parseInt(this.trashRetentionInput.value, 10);
      const days = isNaN(rawRetention) || rawRetention < 0 ? 0 : rawRetention;

      settingsManager.save({
        language: lang,
        trashRetentionDays: days,
      });

      metadataManager.purgeExpired(days);
      this.updateI18nLabels();
      this.renderFilteredTree();
      this.updateWorkspacesDropdown();
      this.updateTrashBadge();
      this.handleStatsChange(this.lastStats);
      this.updateActiveFileIcon();
      this.updateActiveFileNameColor();

      this.modalSettings.style.display = 'none';
    });

    // Вкладки выбора иконок (Векторные значки / Эмодзи)
    this.tabBtnSvg?.addEventListener('click', () => {
      this.tabBtnSvg.classList.add('active');
      this.tabBtnEmoji.classList.remove('active');
      this.panelSvgIcons.style.display = 'block';
      this.panelEmojiIcons.style.display = 'none';
    });

    this.tabBtnEmoji?.addEventListener('click', () => {
      this.tabBtnEmoji.classList.add('active');
      this.tabBtnSvg.classList.remove('active');
      this.panelEmojiIcons.style.display = 'block';
      this.panelSvgIcons.style.display = 'none';
    });

    // Сброс иконки в Icon Picker
    const btnResetIcon = document.getElementById('btn-reset-icon');
    if (btnResetIcon) {
      btnResetIcon.addEventListener('click', () => {
        if (this.iconPickerTarget) {
          metadataManager.removeIcon(this.iconPickerTarget.path);
          this.modalIconPicker.style.display = 'none';
          this.renderFilteredTree();
          this.updateActiveFileIcon();
        }
      });
    }
  }

  private openSettingsModal() {
    const s = settingsManager.get();

    // Пресет темы
    document.querySelectorAll('.preset-chip').forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-preset') === s.themePreset);
    });

    const customBox = document.getElementById('custom-colors-box');
    if (customBox) customBox.style.display = s.themePreset === 'custom' ? 'flex' : 'none';

    // Цвета
    (document.getElementById('picker-bg-color') as HTMLInputElement).value = s.customBg;
    (document.getElementById('picker-accent-color') as HTMLInputElement).value = s.customAccent;

    // Язык
    document.querySelectorAll('.lang-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-lang') === s.language);
    });

    // Срок хранения в корзине
    if (this.trashRetentionInput) {
      this.trashRetentionInput.value = String(s.trashRetentionDays);
    }
    const hint = document.getElementById('trash-retention-unit-hint');
    if (hint) {
      hint.textContent = s.trashRetentionDays === 0 ? t('infinity') : t('daysUnit');
    }

    this.modalSettings.style.display = 'flex';
  }

  private openInfoModal() {
    const lang = settingsManager.get().language;
    this.infoGuideContent.innerHTML = getMarkdownGuideHtml(lang);
    this.modalInfo.style.display = 'flex';
  }

  private openTrashModal() {
    metadataManager.purgeExpired(settingsManager.get().trashRetentionDays);
    const trashItems = metadataManager.getTrash();
    const listEl = document.getElementById('trash-items-list')!;
    const retentionDays = settingsManager.get().trashRetentionDays;

    document.getElementById('txt-trash-notice')!.textContent =
      retentionDays === 0
        ? `${t('trashRetentionNotice')}: ${t('infinity')}`
        : `${t('trashRetentionNotice')} ${retentionDays} ${t('trashRetentionDays')}`;

    listEl.innerHTML = '';

    if (trashItems.length === 0) {
      listEl.innerHTML = `
        <div class="sidebar-empty">
          <p>${t('trashEmpty')}</p>
        </div>
      `;
      this.modalTrash.style.display = 'flex';
      return;
    }

    trashItems.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'trash-card';
      const createdStr = new Date(item.createdAt).toLocaleDateString(settingsManager.get().language);
      const deletedStr = new Date(item.deletedAt).toLocaleDateString(settingsManager.get().language);

      // В кнопке восстановления остается ТОЛЬКО стрелочка (символ без текста)
      card.innerHTML = `
        <div class="trash-card-info">
          <span class="trash-card-title">${item.name}</span>
          <span class="trash-card-dates">${t('created')}: ${createdStr} · ${t('deleted')}: ${deletedStr}</span>
        </div>
        <div class="trash-card-actions">
          <button class="btn-trash-action btn-restore" title="${t('restore')}">
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
          <button class="btn-trash-action danger btn-delete-forever" title="${t('deletePermanently')}">
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      card.querySelector('.btn-restore')?.addEventListener('click', async () => {
        const restored = metadataManager.restoreFromTrash(item.id);
        if (restored) {
          await this.adapter.createFile(restored.name, restored.content);
          this.allEntries = await this.adapter.refresh();
          this.renderFilteredTree();
          this.updateTrashBadge();
          this.openTrashModal();
        }
      });

      card.querySelector('.btn-delete-forever')?.addEventListener('click', () => {
        if (confirm(t('confirmPermanentDelete'))) {
          metadataManager.deletePermanently(item.id);
          this.updateTrashBadge();
          this.openTrashModal();
        }
      });

      listEl.appendChild(card);
    });

    this.modalTrash.style.display = 'flex';
  }

  private openIconPicker(path: string, isDir: boolean) {
    this.iconPickerTarget = { path, isDir };

    const svgGrid = document.getElementById('svg-icons-grid')!;
    const emojiGrid = document.getElementById('emoji-icons-grid')!;

    svgGrid.innerHTML = '';
    emojiGrid.innerHTML = '';

    // Секция цвета названия: только для заметок (файлов)
    if (this.noteColorSection) {
      if (isDir) {
        this.noteColorSection.style.display = 'none';
      } else {
        this.noteColorSection.style.display = 'block';
        const swatchesEl = this.noteColorSwatches;
        if (swatchesEl) {
          swatchesEl.innerHTML = '';
          const activeColor = metadataManager.getColor(path);

          NOTE_COLOR_PALETTE.forEach((color) => {
            const swatch = document.createElement('button');
            swatch.className = `color-swatch-btn ${activeColor === color ? 'active' : ''}`;
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatch.addEventListener('click', () => {
              metadataManager.setColor(path, color);
              swatchesEl.querySelectorAll('.color-swatch-btn').forEach((b) => b.classList.remove('active'));
              swatch.classList.add('active');
              this.renderFilteredTree();
              this.updateActiveFileNameColor();
            });
            swatchesEl.appendChild(swatch);
          });
        }

        if (this.btnResetColor) {
          this.btnResetColor.onclick = () => {
            metadataManager.removeColor(path);
            this.noteColorSwatches?.querySelectorAll('.color-swatch-btn').forEach((b) => b.classList.remove('active'));
            this.renderFilteredTree();
            this.updateActiveFileNameColor();
          };
        }
      }
    }

    // Векторные иконки Flaticon Style
    Object.entries(FLATICON_SVGS).forEach(([id, svgPath]) => {
      const btn = document.createElement('button');
      btn.className = 'icon-pick-btn';
      btn.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svgPath}</svg>`;
      btn.addEventListener('click', () => {
        metadataManager.setIcon(path, id);
        this.modalIconPicker.style.display = 'none';
        this.renderFilteredTree();
        this.updateActiveFileIcon();
      });
      svgGrid.appendChild(btn);
    });

    // Эмодзи
    EMOJI_LIST.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.className = 'icon-pick-btn';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        metadataManager.setIcon(path, emoji);
        this.modalIconPicker.style.display = 'none';
        this.renderFilteredTree();
        this.updateActiveFileIcon();
      });
      emojiGrid.appendChild(btn);
    });

    // Показываем первую вкладку (SVG) по умолчанию
    this.tabBtnSvg.classList.add('active');
    this.tabBtnEmoji.classList.remove('active');
    this.panelSvgIcons.style.display = 'block';
    this.panelEmojiIcons.style.display = 'none';

    this.modalIconPicker.style.display = 'flex';
  }

  private updateActiveFileIcon() {
    if (!this.currentFile) {
      this.activeFileIcon.textContent = '📄';
      return;
    }
    const custom = metadataManager.getIcon(this.currentFile.path);
    this.activeFileIcon.innerHTML = custom ? renderIconPreview(custom) : '📄';
  }

  private updateActiveFileNameColor() {
    if (!this.currentFile) {
      this.activeFileName.style.color = '';
      return;
    }
    const customColor = metadataManager.getColor(this.currentFile.path);
    this.activeFileName.style.color = customColor || '';
  }

  private updateTrashBadge() {
    const count = metadataManager.getTrash().length;
    this.trashBadgeCount.textContent = String(count);
  }

  private updateI18nLabels() {
    document.documentElement.lang = settingsManager.get().language;

    document.getElementById('txt-vault-label')!.textContent = `${t('vault')}:`;
    if (!this.adapter.isOpen()) {
      this.vaultTitle.textContent = this.adapter.isSupported() ? t('notConnected') : t('browserNotSupported');
    }
    document.getElementById('txt-btn-open-vault')!.textContent = t('openFolder');
    document.getElementById('txt-files-title')!.textContent = t('filesAndFolders');
    document.getElementById('txt-workspace-label')!.textContent = `${t('workspace')}:`;
    this.searchInput.placeholder = t('searchPlaceholder');
    document.getElementById('txt-sidebar-empty')!.textContent = t('emptyVaultText');

    // Настройки
    document.getElementById('txt-settings-heading')!.textContent = t('settingsTitle');
    document.getElementById('txt-theme-label')!.textContent = t('theme');
    document.getElementById('txt-bg-color-label')!.textContent = `${t('bgColor')}:`;
    document.getElementById('txt-accent-color-label')!.textContent = `${t('accentColor')}:`;
    document.getElementById('txt-lang-label')!.textContent = t('language');
    document.getElementById('txt-trash-retention-label')!.textContent = t('trashRetentionPeriod');
    const hint = document.getElementById('trash-retention-unit-hint');
    if (hint) {
      hint.textContent = settingsManager.get().trashRetentionDays === 0 ? t('infinity') : t('daysUnit');
    }
    const btnSaveText = document.getElementById('txt-btn-save-settings');
    if (btnSaveText) btnSaveText.textContent = t('applySettings');

    // Корзина
    document.getElementById('txt-trash-heading')!.textContent = t('trashTitle');

    // Выбор иконки или цвета
    document.getElementById('txt-icon-picker-heading')!.textContent = t('chooseIconOrColorTitle');
    document.getElementById('tab-btn-svg')!.textContent = t('tabSvgIcons');
    document.getElementById('tab-btn-emoji')!.textContent = t('tabEmojis');
    document.getElementById('txt-btn-reset-icon')!.textContent = t('resetIconDefault');

    const noteColorLabel = document.getElementById('txt-note-color-label');
    if (noteColorLabel) noteColorLabel.textContent = `${t('noteTitleColor')}:`;
    const btnResetColorText = document.getElementById('txt-btn-reset-color');
    if (btnResetColorText) btnResetColorText.textContent = t('defaultColor');

    // Справка
    document.getElementById('txt-info-heading')!.textContent = t('infoTitle');

    // Кнопки пресетов
    document.getElementById('chip-preset-default')!.querySelector('span:last-child')!.textContent = t('themePresetDefault');
    document.getElementById('chip-preset-oled')!.querySelector('span:last-child')!.textContent = t('themePresetOled');
    document.getElementById('chip-preset-light')!.querySelector('span:last-child')!.textContent = t('themePresetLight');
    document.getElementById('chip-preset-custom')!.querySelector('span:last-child')!.textContent = t('themePresetCustom');

    // Тултипы / подсказки
    this.btnNewFolder.title = t('newFolder');
    this.btnNewNote.title = t('newNote');
    this.btnCollapseSidebar.title = t('collapseSidebar');
    this.btnExpandSidebar.title = t('expandSidebar');
    this.btnOpenTrash.title = t('trash');
    this.btnOpenSettings.title = t('settings');
    this.btnOpenInfo.title = t('infoTooltip');
    this.btnOpenVault.title = this.adapter.isSupported() ? t('openFolder') : t('browserNotSupportedDesc');

    // Обновляем счетчики слов и знаков
    this.handleStatsChange(this.lastStats);
  }

  // ==========================================================================
  // ХРАНИЛИЩЕ И ПРОСТРАНСТВА
  // ==========================================================================
  private async handleOpenVault() {
    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      const entries = await this.adapter.openVault();

      if (!this.adapter.isOpen()) {
        this.setSaveStatus(t('saveStatusReady'), false);
        return;
      }

      this.vaultTitle.textContent = this.adapter.getVaultName();
      this.btnNewNote.disabled = false;
      this.btnNewFolder.disabled = false;
      this.searchInput.disabled = false;
      this.workspaceSelect.disabled = false;
      this.selectedFolder = '';

      this.allEntries = entries;
      this.updateWorkspacesDropdown();
      this.renderFilteredTree();

      // Открываем первую заметку
      const firstFile = entries.find((e) => !e.isDirectory);
      if (firstFile) {
        await this.openFile(firstFile);
      } else {
        const welcome = await this.adapter.createFile(
          t('welcomeFileName'),
          `# ${t('welcomeTitle')}\n\n${t('welcomeBody')}\n`
        );
        this.allEntries = await this.adapter.refresh();
        this.updateWorkspacesDropdown();
        this.renderFilteredTree();
        await this.openFile(welcome);
      }

      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err: any) {
      console.error(t('errorOpenVault'), err);
      alert(`${t('errorOpenVault')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private updateWorkspacesDropdown() {
    // Пространства — это папки верхнего уровня в хранилище
    const topDirs = this.allEntries.filter((e) => e.isDirectory && !e.path.includes('/'));

    this.workspaceSelect.innerHTML = `
      <option value="">${t('allVault')}</option>
    `;

    topDirs.forEach((dir) => {
      const opt = document.createElement('option');
      opt.value = dir.path;
      opt.textContent = `📁 ${dir.name}`;
      this.workspaceSelect.appendChild(opt);
    });

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = t('newWorkspace');
    this.workspaceSelect.appendChild(newOpt);

    const activeWs = settingsManager.get().activeWorkspace;
    if (activeWs && topDirs.some((d) => d.path === activeWs)) {
      this.workspaceSelect.value = activeWs;
      this.selectedFolder = activeWs;
    } else {
      this.workspaceSelect.value = '';
    }
  }

  private async handleCreateWorkspace() {
    const name = prompt(t('promptWorkspaceName'));
    if (!name || !name.trim()) {
      this.workspaceSelect.value = settingsManager.get().activeWorkspace || '';
      return;
    }

    try {
      const dir = await this.adapter.createFolder(name.trim(), '');
      this.allEntries = await this.adapter.refresh();
      settingsManager.save({ activeWorkspace: dir.path });
      this.selectedFolder = dir.path;
      this.updateWorkspacesDropdown();
      this.renderFilteredTree();
    } catch (e: any) {
      alert(`${t('errorCreateFolder')}: ${e.message}`);
    }
  }

  // ==========================================================================
  // ДЕРЕВО ФАЙЛОВ И ДРАГ-ЭНД-ДРОП
  // ==========================================================================
  private renderFilteredTree() {
    let filtered = [...this.allEntries];

    // Фильтр по активному пространству
    const activeWs = settingsManager.get().activeWorkspace;
    if (activeWs) {
      filtered = filtered.filter((e) => e.path === activeWs || e.path.startsWith(`${activeWs}/`));
    }

    // Фильтр по поисковому запросу
    if (this.searchQuery) {
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(this.searchQuery));
    }

    const filesTotal = filtered.filter((e) => !e.isDirectory).length;
    this.filesCount.textContent = formatNotesCount(filesTotal);

    this.fileListContainer.innerHTML = '';

    if (filtered.length === 0) {
      this.fileListContainer.innerHTML = `
        <div class="sidebar-empty">
          <p>${this.searchQuery ? t('nothingFound') : t('emptyFolderText')}</p>
        </div>
      `;
      return;
    }

    const tree = this.buildTree(filtered);
    const fragment = document.createDocumentFragment();
    this.renderTreeNodes(tree, fragment);
    this.fileListContainer.appendChild(fragment);
  }

  private buildTree(entries: FileEntry[]): TreeNode {
    const root: TreeNode = {
      name: '',
      path: '',
      isDirectory: true,
      children: new Map(),
    };

    for (const entry of entries) {
      const parts = entry.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            path: currentPath,
            isDirectory: isLast ? entry.isDirectory : true,
            children: new Map(),
            fileEntry: isLast ? entry : undefined,
          });
        }
        current = current.children.get(part)!;
      }
    }

    return root;
  }

  private renderTreeNodes(parentNode: TreeNode, container: HTMLElement | DocumentFragment) {
    const nodes = Array.from(parentNode.children.values());

    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    for (const node of nodes) {
      const customIcon = metadataManager.getIcon(node.path);

      if (node.isDirectory) {
        const isCollapsed = this.collapsedFolders.has(node.path);
        const isSelected = this.selectedFolder === node.path;

        const folderEl = document.createElement('div');
        folderEl.className = 'folder-item';

        const row = document.createElement('div');
        row.className = `folder-row ${isSelected ? 'selected' : ''}`;
        row.draggable = true;

        const iconHtml = customIcon ? renderIconPreview(customIcon) : (isCollapsed ? '📁' : '📂');

        // В строке папки 4 действия: новый файл, новая папка, переименовать, удалить
        row.innerHTML = `
          <span class="folder-chevron ${isCollapsed ? '' : 'open'}" title="${isCollapsed ? t('expandSidebar') : t('collapseSidebar')}">
            <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          <span class="item-icon-wrapper" title="${t('changeIconOrColor')}">
            <span class="folder-icon">${iconHtml}</span>
          </span>
          <span class="folder-name" title="${node.path}">${node.name}</span>
          <div class="folder-actions">
            <button class="folder-act-btn btn-folder-new-file" title="${t('createNoteInFolder')}">
              <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="folder-act-btn btn-folder-new-sub" title="${t('createSubfolder')}">
              <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
            </button>
            <button class="folder-act-btn btn-folder-rename" title="${t('renameFolder')}">
              <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="folder-act-btn danger btn-folder-delete" title="${t('deleteFolder')}">
              <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        `;

        // Шеврон: ТОЛЬКО сворачивание/разворачивание
        const chevron = row.querySelector('.folder-chevron');
        chevron?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.collapsedFolders.has(node.path)) {
            this.collapsedFolders.delete(node.path);
          } else {
            this.collapsedFolders.add(node.path);
          }
          this.renderFilteredTree();
        });

        // Клик по иконке открывает Icon/Color Picker
        const iconWrapper = row.querySelector('.item-icon-wrapper');
        iconWrapper?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openIconPicker(node.path, true);
        });

        // 4 Действия папки
        const btnNewFile = row.querySelector('.btn-folder-new-file');
        btnNewFile?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleCreateNewNoteIn(node.path);
        });

        const btnNewSub = row.querySelector('.btn-folder-new-sub');
        btnNewSub?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleCreateNewFolderIn(node.path);
        });

        const btnRenameDir = row.querySelector('.btn-folder-rename');
        btnRenameDir?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleRenameFolder(node);
        });

        const btnDeleteDir = row.querySelector('.btn-folder-delete');
        btnDeleteDir?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleDeleteFolder(node);
        });

        // Клик по самой строке папки: ТОЛЬКО выделение папки!
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedFolder = this.selectedFolder === node.path ? '' : node.path;
          this.renderFilteredTree();
        });

        // Драг-энд-дроп для папки
        this.bindDragAndDrop(row, node.path, true);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = `folder-children ${isCollapsed ? 'collapsed' : ''}`;

        folderEl.appendChild(row);
        this.renderTreeNodes(node, childrenContainer);
        folderEl.appendChild(childrenContainer);

        container.appendChild(folderEl);
      } else {
        const fileEl = document.createElement('div');
        const isActive = this.currentFile?.path === node.path;
        fileEl.className = `file-item ${isActive ? 'active' : ''}`;
        fileEl.draggable = true;

        const iconHtml = customIcon ? renderIconPreview(customIcon) : '📄';
        const customColor = metadataManager.getColor(node.path);
        const colorStyle = customColor ? `style="color: ${customColor};"` : '';

        // В строке заметки: переименовать и удалить в корзину
        fileEl.innerHTML = `
          <span class="item-icon-wrapper" title="${t('changeIconOrColor')}">
            <span class="file-item-icon">${iconHtml}</span>
          </span>
          <span class="file-item-name" title="${node.path}" ${colorStyle}>${node.name}</span>
          <div class="file-actions">
            <button class="file-act-btn btn-file-rename" title="${t('renameNote')}">
              <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="file-act-btn danger btn-file-delete" title="${t('trash')}">
              <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        `;

        // Клик по иконке файла открывает Icon/Color Picker
        const iconWrapper = fileEl.querySelector('.item-icon-wrapper');
        iconWrapper?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openIconPicker(node.path, false);
        });

        // Переименование файла
        const btnRename = fileEl.querySelector('.btn-file-rename');
        btnRename?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleRenameFile(node);
        });

        // Удаление файла в корзину
        fileEl.querySelector('.btn-file-delete')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.handleDeleteFile(node);
        });

        // Драг-энд-дроп для файла
        this.bindDragAndDrop(fileEl, node.path, false);

        fileEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (node.fileEntry) {
            this.openFile(node.fileEntry);
            if (window.innerWidth <= 768) {
              this.sidebar.classList.remove('open');
            }
          }
        });

        container.appendChild(fileEl);
      }
    }
  }

  // Привязка событий Drag-and-Drop
  private bindDragAndDrop(element: HTMLElement, path: string, isDirectory: boolean) {
    element.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      e.dataTransfer!.setData('text/plain', path);
      element.classList.add('dragging');
    });

    element.addEventListener('dragend', () => {
      element.classList.remove('dragging');
      document.querySelectorAll('.folder-row.drag-over').forEach((el) => el.classList.remove('drag-over'));
    });

    if (isDirectory) {
      element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.add('drag-over');
      });

      element.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.remove('drag-over');
      });

      element.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.remove('drag-over');

        const sourcePath = e.dataTransfer!.getData('text/plain');
        if (!sourcePath || sourcePath === path || sourcePath.startsWith(`${path}/`)) {
          return;
        }

        try {
          this.setSaveStatus(t('saveStatusSaving'), true);
          const movedEntry = await this.adapter.moveEntry(sourcePath, path);
          metadataManager.migratePath(sourcePath, movedEntry.path, this.adapter.isOpen());
          this.allEntries = await this.adapter.refresh();
          this.renderFilteredTree();
          this.setSaveStatus(t('saveStatusSaved'), false);
        } catch (err: any) {
          console.error(t('errorMove'), err);
          alert(`${t('errorMove')}: ${err.message}`);
          this.setSaveStatus(t('saveStatusError'), false);
        }
      });
    }
  }

  // ==========================================================================
  // РАБОТА С ФАЙЛАМИ И ПАПКАМИ
  // ==========================================================================
  private async openFile(file: FileEntry) {
    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      this.currentFile = file;
      this.activeFileName.textContent = file.name;
      this.updateActiveFileIcon();
      this.updateActiveFileNameColor();

      const text = await this.adapter.readFile(file.path);
      if (this.editor) {
        this.editor.setContent(text);
        this.editor.focus();
      }

      this.renderFilteredTree();
      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err: any) {
      console.error(t('errorReadFile'), err);
      alert(`${t('errorReadFile')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleContentChange(content: string) {
    if (!this.currentFile || !this.adapter.isOpen()) return;

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      await this.adapter.writeFile(this.currentFile.path, content);
      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err) {
      console.error(t('saveStatusError'), err);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleCreateNewNote() {
    if (!this.adapter.isOpen()) return;

    const folderHint = this.selectedFolder ? ` (${this.selectedFolder})` : '';
    const name = prompt(`${t('promptNoteName')}${folderHint}:`, t('newNote'));
    if (!name || name.trim().length === 0) return;

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      const cleanName = name.trim();
      const newFile = await this.adapter.createFile(
        cleanName,
        `# ${cleanName}\n\n${t('created')}: ${new Date().toLocaleString()}\n\n`,
        this.selectedFolder
      );

      if (this.selectedFolder) {
        this.collapsedFolders.delete(this.selectedFolder);
      }

      this.allEntries = await this.adapter.refresh();
      this.renderFilteredTree();
      await this.openFile(newFile);
      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err: any) {
      console.error(t('errorCreateFile'), err);
      alert(`${t('errorCreateFile')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleCreateNewNoteIn(parentPath: string) {
    if (!this.adapter.isOpen()) return;

    const name = prompt(`${t('promptNoteName')} (${parentPath}):`, t('newNote'));
    if (!name || name.trim().length === 0) return;

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      const cleanName = name.trim();
      const newFile = await this.adapter.createFile(
        cleanName,
        `# ${cleanName}\n\n${t('created')}: ${new Date().toLocaleString()}\n\n`,
        parentPath
      );

      this.collapsedFolders.delete(parentPath);
      this.selectedFolder = parentPath;
      this.allEntries = await this.adapter.refresh();
      this.renderFilteredTree();
      await this.openFile(newFile);
      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err: any) {
      console.error(t('errorCreateFile'), err);
      alert(`${t('errorCreateFile')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleCreateNewFolder() {
    if (!this.adapter.isOpen()) return;

    const folderHint = this.selectedFolder ? ` (${this.selectedFolder})` : '';
    const name = prompt(`${t('promptFolderName')}${folderHint}:`, t('newFolder'));
    if (!name || name.trim().length === 0) return;

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      await this.adapter.createFolder(name.trim(), this.selectedFolder);

      if (this.selectedFolder) {
        this.collapsedFolders.delete(this.selectedFolder);
      }

      this.allEntries = await this.adapter.refresh();
      this.updateWorkspacesDropdown();
      this.renderFilteredTree();
      this.setSaveStatus(t('saveStatusReady'), false);
    } catch (err: any) {
      console.error(t('errorCreateFolder'), err);
      alert(`${t('errorCreateFolder')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleCreateNewFolderIn(parentPath: string) {
    if (!this.adapter.isOpen()) return;

    const name = prompt(`${t('promptFolderName')} (${parentPath}):`, t('newFolder'));
    if (!name || name.trim().length === 0) return;

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      await this.adapter.createFolder(name.trim(), parentPath);

      this.collapsedFolders.delete(parentPath);
      this.selectedFolder = parentPath;
      this.allEntries = await this.adapter.refresh();
      this.updateWorkspacesDropdown();
      this.renderFilteredTree();
      this.setSaveStatus(t('saveStatusReady'), false);
    } catch (err: any) {
      console.error(t('errorCreateFolder'), err);
      alert(`${t('errorCreateFolder')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleRenameFolder(node: TreeNode) {
    const newName = prompt(t('promptRenameFolder'), node.name);
    if (!newName || !newName.trim() || newName.trim() === node.name) return;

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      const res = await this.adapter.renameFolder(node.path, newName.trim());
      metadataManager.migratePath(node.path, res.path, true);

      if (this.selectedFolder === node.path) {
        this.selectedFolder = res.path;
      } else if (this.selectedFolder.startsWith(`${node.path}/`)) {
        this.selectedFolder = `${res.path}${this.selectedFolder.slice(node.path.length)}`;
      }

      if (this.collapsedFolders.has(node.path)) {
        this.collapsedFolders.delete(node.path);
        this.collapsedFolders.add(res.path);
      }

      this.allEntries = await this.adapter.refresh();
      this.updateWorkspacesDropdown();
      this.renderFilteredTree();
      this.setSaveStatus(t('saveStatusReady'), false);
    } catch (err: any) {
      console.error(t('errorCreateFolder'), err);
      alert(`${t('errorCreateFolder')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleRenameFile(node: TreeNode) {
    const rawBaseName = node.name.replace(/\.md$/, '');
    const newName = prompt(t('promptRenameNote'), rawBaseName);
    if (!newName || !newName.trim()) return;

    const cleanWithExt = newName.trim().endsWith('.md') ? newName.trim() : `${newName.trim()}.md`;
    if (cleanWithExt === node.name) return;

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      const res = await this.adapter.renameFile(node.path, cleanWithExt);
      metadataManager.migratePath(node.path, res.path, false);

      if (this.currentFile?.path === node.path) {
        this.currentFile = res;
        this.activeFileName.textContent = res.name;
        this.updateActiveFileNameColor();
      }

      this.allEntries = await this.adapter.refresh();
      this.renderFilteredTree();
      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err: any) {
      console.error(t('errorCreateFile'), err);
      alert(`${t('errorCreateFile')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleDeleteFolder(node: TreeNode) {
    if (!confirm(t('confirmDeleteFolder', { name: node.name }))) {
      return;
    }

    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      await this.adapter.deleteFolder(node.path);

      if (this.selectedFolder === node.path || this.selectedFolder.startsWith(`${node.path}/`)) {
        this.selectedFolder = '';
      }

      if (this.currentFile && (this.currentFile.path === node.path || this.currentFile.path.startsWith(`${node.path}/`))) {
        this.currentFile = null;
        this.activeFileName.textContent = '';
        this.activeFileIcon.textContent = '📄';
        this.activeFileName.style.color = '';
        this.editor?.setContent('');
      }

      this.allEntries = await this.adapter.refresh();
      this.updateWorkspacesDropdown();
      this.renderFilteredTree();
      this.setSaveStatus(t('saveStatusReady'), false);
    } catch (err: any) {
      console.error(t('errorDelete'), err);
      alert(`${t('errorDelete')}: ${err.message}`);
      this.setSaveStatus(t('saveStatusError'), false);
    }
  }

  private async handleDeleteFile(node: TreeNode) {
    try {
      const content = await this.adapter.readFile(node.path);

      // Добавляем в корзину с таймштампами
      metadataManager.addToTrash({
        name: node.name,
        originalPath: node.path,
        content,
        createdAt: node.fileEntry?.lastModified || Date.now() - 86400000,
      });

      // Удаляем из файловой системы
      await this.adapter.deleteFile(node.path);

      this.allEntries = await this.adapter.refresh();
      this.updateTrashBadge();

      // Если был открыт удаляемый файл — очищаем редактор
      if (this.currentFile?.path === node.path) {
        this.currentFile = null;
        this.activeFileName.textContent = '';
        this.activeFileIcon.textContent = '📄';
        this.activeFileName.style.color = '';
        this.editor?.setContent('');
      }

      this.renderFilteredTree();
    } catch (err: any) {
      console.error(t('errorDelete'), err);
      alert(`${t('errorDelete')}: ${err.message}`);
    }
  }

  private setSaveStatus(text: string, isSaving: boolean) {
    this.saveStatusText.textContent = text;
    if (isSaving) {
      this.saveBadge.classList.add('saving');
    } else {
      this.saveBadge.classList.remove('saving');
    }
  }

  private handleStatsChange(stats: EditorStats) {
    this.lastStats = stats;
    this.statWords.textContent = formatWordsCount(stats.words);
    this.statChars.textContent = formatCharsCount(stats.chars);
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  new BasaltApp();
});
