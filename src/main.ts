import { WebFileAdapter } from './core/adapter/WebFileAdapter';
import type { FileEntry } from './core/adapter/FileSystemAdapter';
import { BasaltEditor, type EditorStats } from './core/editor/editor';
import { t, type Language } from './core/i18n/i18n';
import { settingsManager, type ThemePreset } from './core/settings/settings';
import { metadataManager } from './core/metadata/metadata';
import { FLATICON_SVGS, EMOJI_LIST, renderIconPreview } from './core/icons/icons';

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Map<string, TreeNode>;
  fileEntry?: FileEntry;
}

class BasaltApp {
  private adapter = new WebFileAdapter();
  private editor: BasaltEditor | null = null;
  private currentFile: FileEntry | null = null;
  private selectedFolder: string = '';
  private collapsedFolders = new Set<string>();
  private allEntries: FileEntry[] = [];
  private searchQuery: string = '';
  private iconPickerTarget: { path: string; isDir: boolean } | null = null;

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

  // Новые элементы: поиск, пространства, сворачивание
  private searchInput = document.getElementById('search-input') as HTMLInputElement;
  private btnClearSearch = document.getElementById('btn-clear-search') as HTMLButtonElement;
  private workspaceSelect = document.getElementById('workspace-select') as HTMLSelectElement;
  private btnCollapseSidebar = document.getElementById('btn-collapse-sidebar') as HTMLButtonElement;
  private btnExpandSidebar = document.getElementById('btn-expand-sidebar') as HTMLButtonElement;

  // Модальные окна и корзина
  private btnOpenTrash = document.getElementById('btn-open-trash') as HTMLButtonElement;
  private btnOpenSettings = document.getElementById('btn-open-settings') as HTMLButtonElement;
  private trashBadgeCount = document.getElementById('trash-badge-count') as HTMLElement;
  private modalSettings = document.getElementById('modal-settings') as HTMLElement;
  private modalIconPicker = document.getElementById('modal-icon-picker') as HTMLElement;
  private modalTrash = document.getElementById('modal-trash') as HTMLElement;

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
      this.vaultTitle.textContent = 'Браузер не поддерживается';
      this.btnOpenVault.disabled = true;
      this.btnOpenVault.title = 'Требуется браузер с поддержкой File System Access API (Chrome, Edge)';
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

    // Корзина и Настройки
    this.btnOpenTrash.addEventListener('click', () => this.openTrashModal());
    this.btnOpenSettings.addEventListener('click', () => this.openSettingsModal());
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
      });
    });

    // Срок хранения корзины
    const retentionSlider = document.getElementById('trash-retention-slider') as HTMLInputElement;
    const retentionVal = document.getElementById('trash-retention-value') as HTMLElement;
    const retentionUnit = document.getElementById('trash-retention-unit') as HTMLElement;

    retentionSlider.addEventListener('input', () => {
      const days = parseInt(retentionSlider.value, 10);
      retentionVal.textContent = days === 0 ? t('infinity') : String(days);
      retentionUnit.textContent = days === 0 ? '' : t('daysCount');
      settingsManager.save({ trashRetentionDays: days });
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

    // Обновляем пресет
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

    // Корзина
    const slider = document.getElementById('trash-retention-slider') as HTMLInputElement;
    slider.value = String(s.trashRetentionDays);
    const valEl = document.getElementById('trash-retention-value')!;
    valEl.textContent = s.trashRetentionDays === 0 ? t('infinity') : String(s.trashRetentionDays);
    document.getElementById('trash-retention-unit')!.textContent =
      s.trashRetentionDays === 0 ? '' : t('daysCount');

    this.modalSettings.style.display = 'flex';
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
      const createdStr = new Date(item.createdAt).toLocaleDateString();
      const deletedStr = new Date(item.deletedAt).toLocaleDateString();

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
            <span>${t('restore')}</span>
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

  private updateTrashBadge() {
    const count = metadataManager.getTrash().length;
    this.trashBadgeCount.textContent = String(count);
  }

  private updateI18nLabels() {
    document.getElementById('txt-vault-label')!.textContent = `${t('vault')}:`;
    document.getElementById('txt-btn-open-vault')!.textContent = t('openFolder');
    document.getElementById('txt-files-title')!.textContent = t('filesAndFolders');
    document.getElementById('txt-workspace-label')!.textContent = `${t('workspace')}:`;
    this.searchInput.placeholder = t('searchPlaceholder');
    document.getElementById('txt-sidebar-empty')!.textContent = t('emptyVaultText');
    document.getElementById('txt-settings-heading')!.textContent = t('settingsTitle');
    document.getElementById('txt-theme-label')!.textContent = t('theme');
    document.getElementById('txt-bg-color-label')!.textContent = `${t('bgColor')}:`;
    document.getElementById('txt-accent-color-label')!.textContent = `${t('accentColor')}:`;
    document.getElementById('txt-lang-label')!.textContent = t('language');
    document.getElementById('txt-trash-retention-label')!.textContent = t('trashRetentionPeriod');
    document.getElementById('txt-trash-heading')!.textContent = t('trashTitle');
    document.getElementById('txt-icon-picker-heading')!.textContent = t('chooseIconTitle');

    // Кнопки пресетов
    document.getElementById('chip-preset-default')!.querySelector('span:last-child')!.textContent = t('themePresetDefault');
    document.getElementById('chip-preset-oled')!.querySelector('span:last-child')!.textContent = t('themePresetOled');
    document.getElementById('chip-preset-light')!.querySelector('span:last-child')!.textContent = t('themePresetLight');
    document.getElementById('chip-preset-custom')!.querySelector('span:last-child')!.textContent = t('themePresetCustom');
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
          'Заметки.md',
          `# ${t('welcomeTitle')}\n\nПапка пуста. Начните писать здесь свои мысли или нажмите **«+»**, чтобы создать новую заметку.\n`
        );
        this.allEntries = await this.adapter.refresh();
        this.updateWorkspacesDropdown();
        this.renderFilteredTree();
        await this.openFile(welcome);
      }

      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err: any) {
      console.error('Ошибка открытия папки:', err);
      alert(`Не удалось открыть папку: ${err.message}`);
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
      alert(`Ошибка создания пространства: ${e.message}`);
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
    this.filesCount.textContent = `${filesTotal} ${t('notesCount')}`;

    this.fileListContainer.innerHTML = '';

    if (filtered.length === 0) {
      this.fileListContainer.innerHTML = `
        <div class="sidebar-empty">
          <p>${this.searchQuery ? 'Ничего не найдено' : t('emptyFolderText')}</p>
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

        row.innerHTML = `
          <span class="folder-chevron ${isCollapsed ? '' : 'open'}">
            <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          <span class="item-icon-wrapper" data-tooltip="${t('changeIcon')}" title="${t('changeIcon')}">
            <span class="folder-icon">${iconHtml}</span>
          </span>
          <span class="folder-name" title="${node.path}">${node.name}</span>
        `;

        // Клик по иконке открывает Icon Picker
        const iconWrapper = row.querySelector('.item-icon-wrapper');
        iconWrapper?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openIconPicker(node.path, true);
        });

        // Драг-энд-дроп для папки
        this.bindDragAndDrop(row, node.path, true);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = `folder-children ${isCollapsed ? 'collapsed' : ''}`;

        row.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.collapsedFolders.has(node.path)) {
            this.collapsedFolders.delete(node.path);
          } else {
            this.collapsedFolders.add(node.path);
          }

          this.selectedFolder = this.selectedFolder === node.path ? '' : node.path;
          this.renderFilteredTree();
        });

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

        fileEl.innerHTML = `
          <span class="item-icon-wrapper" data-tooltip="${t('changeIcon')}" title="${t('changeIcon')}">
            <span class="file-item-icon">${iconHtml}</span>
          </span>
          <span class="file-item-name" title="${node.path}">${node.name}</span>
          <button class="file-item-delete" title="${t('trash')}">
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        `;

        // Клик по иконке файла открывает Icon Picker
        const iconWrapper = fileEl.querySelector('.item-icon-wrapper');
        iconWrapper?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openIconPicker(node.path, false);
        });

        // Драг-энд-дроп для файла
        this.bindDragAndDrop(fileEl, node.path, false);

        // Удаление файла в корзину
        fileEl.querySelector('.file-item-delete')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.handleDeleteFile(node);
        });

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
          await this.adapter.moveEntry(sourcePath, path);
          this.allEntries = await this.adapter.refresh();
          this.renderFilteredTree();
          this.setSaveStatus(t('saveStatusSaved'), false);
        } catch (err: any) {
          console.error('Ошибка перемещения:', err);
          alert(`Не удалось переместить: ${err.message}`);
          this.setSaveStatus(t('saveStatusError'), false);
        }
      });
    }
  }

  // ==========================================================================
  // РАБОТА С ФАЙЛАМИ
  // ==========================================================================
  private async openFile(file: FileEntry) {
    try {
      this.setSaveStatus(t('saveStatusSaving'), true);
      this.currentFile = file;
      this.activeFileName.textContent = file.name;
      this.updateActiveFileIcon();

      const text = await this.adapter.readFile(file.path);
      if (this.editor) {
        this.editor.setContent(text);
        this.editor.focus();
      }

      this.renderFilteredTree();
      this.setSaveStatus(t('saveStatusSaved'), false);
    } catch (err: any) {
      console.error('Ошибка чтения файла:', err);
      alert(`Не удалось прочитать файл: ${err.message}`);
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
      console.error('Ошибка автосохранения:', err);
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
      console.error('Ошибка создания заметки:', err);
      alert(`Не удалось создать файл: ${err.message}`);
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
      console.error('Ошибка создания папки:', err);
      alert(`Не удалось создать папку: ${err.message}`);
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
        this.editor?.setContent('');
      }

      this.renderFilteredTree();
    } catch (err: any) {
      console.error('Ошибка удаления:', err);
      alert(`Не удалось удалить: ${err.message}`);
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
    this.statWords.textContent = `${stats.words} ${t('wordsCount')}`;
    this.statChars.textContent = `${stats.chars} ${t('charsCount')}`;
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  new BasaltApp();
});
