import { WebFileAdapter } from './core/adapter/WebFileAdapter';
import type { FileEntry } from './core/adapter/FileSystemAdapter';
import { BasaltEditor, type EditorStats } from './core/editor/editor';

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

  // DOM Элементы
  private btnOpenVault = document.getElementById('btn-open-vault') as HTMLButtonElement;
  private btnNewNote = document.getElementById('btn-new-note') as HTMLButtonElement;
  private btnNewFolder = document.getElementById('btn-new-folder') as HTMLButtonElement;
  private vaultTitle = document.getElementById('vault-title') as HTMLElement;
  private fileListContainer = document.getElementById('file-list') as HTMLElement;
  private filesCount = document.getElementById('files-count') as HTMLElement;
  private activeFileName = document.getElementById('active-file-name') as HTMLElement;
  private saveBadge = document.getElementById('save-badge') as HTMLElement;
  private saveStatusText = document.getElementById('save-status-text') as HTMLElement;
  private statWords = document.getElementById('stat-words') as HTMLElement;
  private statChars = document.getElementById('stat-chars') as HTMLElement;
  private btnToggleSidebar = document.getElementById('btn-toggle-sidebar') as HTMLButtonElement;
  private sidebar = document.getElementById('sidebar') as HTMLElement;
  private editorMount = document.getElementById('editor-mount') as HTMLElement;

  constructor() {
    this.initEditor();
    this.bindEvents();
    this.checkBrowserSupport();
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

    if (this.btnToggleSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => {
        this.sidebar.classList.toggle('open');
      });
    }
  }

  private async handleOpenVault() {
    try {
      this.setSaveStatus('Открытие...', true);
      const entries = await this.adapter.openVault();

      if (!this.adapter.isOpen()) {
        this.setSaveStatus('Готово', false);
        return;
      }

      this.vaultTitle.textContent = this.adapter.getVaultName();
      this.btnNewNote.disabled = false;
      this.btnNewFolder.disabled = false;
      this.selectedFolder = '';

      await this.refreshAndRenderTree(entries);

      // Открываем первую заметку, если есть, или создаём приветственную
      const firstFile = entries.find((e) => !e.isDirectory);
      if (firstFile) {
        await this.openFile(firstFile);
      } else {
        const welcome = await this.adapter.createFile(
          'Заметки.md',
          '# Моё хранилище Basalt\n\nПапка пуста. Начните писать здесь свои мысли или нажмите **«+»**, чтобы создать новую заметку.\n'
        );
        const updated = await this.adapter.refresh();
        await this.refreshAndRenderTree(updated);
        await this.openFile(welcome);
      }

      this.setSaveStatus('Сохранено ✓', false);
    } catch (err: any) {
      console.error('Ошибка открытия папки:', err);
      alert(`Не удалось открыть папку: ${err.message}`);
      this.setSaveStatus('Ошибка', false);
    }
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

  private async refreshAndRenderTree(entries?: FileEntry[]) {
    const allEntries = entries || (await this.adapter.refresh());
    const filesTotal = allEntries.filter((e) => !e.isDirectory).length;
    this.filesCount.textContent = `${filesTotal} заметок`;

    this.fileListContainer.innerHTML = '';

    if (allEntries.length === 0) {
      this.fileListContainer.innerHTML = `
        <div class="sidebar-empty">
          <p>В этой папке пока нет файлов или подпапок</p>
        </div>
      `;
      return;
    }

    const tree = this.buildTree(allEntries);
    const fragment = document.createDocumentFragment();
    this.renderTreeNodes(tree, fragment);
    this.fileListContainer.appendChild(fragment);
  }

  private renderTreeNodes(parentNode: TreeNode, container: HTMLElement | DocumentFragment) {
    const nodes = Array.from(parentNode.children.values());

    // Сортировка: сначала папки по алфавиту, затем файлы по алфавиту
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    for (const node of nodes) {
      if (node.isDirectory) {
        const isCollapsed = this.collapsedFolders.has(node.path);
        const isSelected = this.selectedFolder === node.path;

        const folderEl = document.createElement('div');
        folderEl.className = 'folder-item';

        const row = document.createElement('div');
        row.className = `folder-row ${isSelected ? 'selected' : ''}`;
        row.innerHTML = `
          <span class="folder-chevron ${isCollapsed ? '' : 'open'}">
            <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </span>
          <span class="folder-icon">${isCollapsed ? '📁' : '📂'}</span>
          <span class="folder-name" title="${node.path}">${node.name}</span>
        `;

        const childrenContainer = document.createElement('div');
        childrenContainer.className = `folder-children ${isCollapsed ? 'collapsed' : ''}`;

        row.addEventListener('click', (e) => {
          e.stopPropagation();
          // Переключение свернуть/развернуть
          if (this.collapsedFolders.has(node.path)) {
            this.collapsedFolders.delete(node.path);
          } else {
            this.collapsedFolders.add(node.path);
          }

          // Выбор активной целевой папки
          this.selectedFolder = this.selectedFolder === node.path ? '' : node.path;
          this.refreshAndRenderTree();
        });

        folderEl.appendChild(row);

        // Рекурсивно рендерим содержимое папки
        this.renderTreeNodes(node, childrenContainer);
        folderEl.appendChild(childrenContainer);

        container.appendChild(folderEl);
      } else {
        const fileEl = document.createElement('div');
        const isActive = this.currentFile?.path === node.path;
        fileEl.className = `file-item ${isActive ? 'active' : ''}`;
        fileEl.innerHTML = `
          <span class="file-item-icon">📄</span>
          <span class="file-item-name" title="${node.path}">${node.name}</span>
        `;

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

  private async openFile(file: FileEntry) {
    try {
      this.setSaveStatus('Загрузка...', true);
      this.currentFile = file;
      this.activeFileName.textContent = file.name;

      const text = await this.adapter.readFile(file.path);
      if (this.editor) {
        this.editor.setContent(text);
        this.editor.focus();
      }

      await this.refreshAndRenderTree();
      this.setSaveStatus('Сохранено ✓', false);
    } catch (err: any) {
      console.error('Ошибка чтения файла:', err);
      alert(`Не удалось прочитать файл: ${err.message}`);
      this.setSaveStatus('Ошибка чтения', false);
    }
  }

  private async handleContentChange(content: string) {
    if (!this.currentFile || !this.adapter.isOpen()) return;

    try {
      this.setSaveStatus('Сохранение...', true);
      await this.adapter.writeFile(this.currentFile.path, content);
      this.setSaveStatus('Сохранено ✓', false);
    } catch (err) {
      console.error('Ошибка автосохранения:', err);
      this.setSaveStatus('Ошибка записи', false);
    }
  }

  private async handleCreateNewNote() {
    if (!this.adapter.isOpen()) return;

    const folderHint = this.selectedFolder ? ` (в папку: "${this.selectedFolder}")` : ' (в корень хранилища)';
    const name = prompt(`Введите название заметки${folderHint}:`, 'Новая заметка');
    if (!name || name.trim().length === 0) return;

    try {
      this.setSaveStatus('Создание...', true);
      const cleanName = name.trim();
      const newFile = await this.adapter.createFile(
        cleanName,
        `# ${cleanName}\n\nСоздано: ${new Date().toLocaleString()}\n\n`,
        this.selectedFolder
      );

      // Раскрываем родительскую папку, если была свернута
      if (this.selectedFolder) {
        this.collapsedFolders.delete(this.selectedFolder);
      }

      await this.refreshAndRenderTree();
      await this.openFile(newFile);
      this.setSaveStatus('Сохранено ✓', false);
    } catch (err: any) {
      console.error('Ошибка создания заметки:', err);
      alert(`Не удалось создать файл: ${err.message}`);
      this.setSaveStatus('Ошибка', false);
    }
  }

  private async handleCreateNewFolder() {
    if (!this.adapter.isOpen()) return;

    const folderHint = this.selectedFolder ? ` (внутри: "${this.selectedFolder}")` : ' (в корне хранилища)';
    const name = prompt(`Введите название новой папки${folderHint}:`, 'Новая папка');
    if (!name || name.trim().length === 0) return;

    try {
      this.setSaveStatus('Создание папки...', true);
      await this.adapter.createFolder(name.trim(), this.selectedFolder);

      if (this.selectedFolder) {
        this.collapsedFolders.delete(this.selectedFolder);
      }

      await this.refreshAndRenderTree();
      this.setSaveStatus('Готово', false);
    } catch (err: any) {
      console.error('Ошибка создания папки:', err);
      alert(`Не удалось создать папку: ${err.message}`);
      this.setSaveStatus('Ошибка', false);
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
    this.statWords.textContent = `${stats.words} слов`;
    this.statChars.textContent = `${stats.chars} знаков`;
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  new BasaltApp();
});
