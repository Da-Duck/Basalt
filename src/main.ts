import { WebFileAdapter } from './core/adapter/WebFileAdapter';
import type { FileEntry } from './core/adapter/FileSystemAdapter';
import { BasaltEditor, type EditorStats } from './core/editor/editor';

class BasaltApp {
  private adapter = new WebFileAdapter();
  private editor: BasaltEditor | null = null;
  private currentFile: FileEntry | null = null;
  private files: FileEntry[] = [];

  // DOM Элементы
  private btnOpenVault = document.getElementById('btn-open-vault') as HTMLButtonElement;
  private btnNewNote = document.getElementById('btn-new-note') as HTMLButtonElement;
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
      this.files = entries.filter((e) => !e.isDirectory);

      this.renderFileList();

      // Открываем первую заметку, если есть, или создаём приветственную
      if (this.files.length > 0) {
        await this.openFile(this.files[0]);
      } else {
        const welcome = await this.adapter.createFile(
          'Заметки.md',
          '# Моё хранилище Basalt\n\nПапка пуста. Начните писать здесь свои мысли или нажмите **«+»**, чтобы создать новую заметку.\n'
        );
        this.files.push(welcome);
        this.renderFileList();
        await this.openFile(welcome);
      }

      this.setSaveStatus('Сохранено ✓', false);
    } catch (err: any) {
      console.error('Ошибка открытия папки:', err);
      alert(`Не удалось открыть папку: ${err.message}`);
      this.setSaveStatus('Ошибка', false);
    }
  }

  private renderFileList() {
    this.fileListContainer.innerHTML = '';
    this.filesCount.textContent = `${this.files.length} заметок`;

    if (this.files.length === 0) {
      this.fileListContainer.innerHTML = `
        <div class="sidebar-empty">
          <p>В этой папке пока нет Markdown-файлов</p>
        </div>
      `;
      return;
    }

    this.files.forEach((file) => {
      const item = document.createElement('div');
      item.className = `file-item ${this.currentFile?.path === file.path ? 'active' : ''}`;
      item.innerHTML = `
        <span class="file-item-icon">📝</span>
        <span class="file-item-name" title="${file.path}">${file.name}</span>
      `;

      item.addEventListener('click', () => {
        this.openFile(file);
        // На мобильных скрываем сайдбар после выбора файла
        if (window.innerWidth <= 768) {
          this.sidebar.classList.remove('open');
        }
      });

      this.fileListContainer.appendChild(item);
    });
  }

  private async openFile(file: FileEntry) {
    try {
      this.setSaveStatus('Загрузка...', true);
      this.currentFile = file;
      this.activeFileName.textContent = file.name;

      // Обновляем активный класс в списке
      const allItems = this.fileListContainer.querySelectorAll('.file-item');
      allItems.forEach((el) => {
        const nameEl = el.querySelector('.file-item-name');
        if (nameEl && nameEl.textContent === file.name) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      const text = await this.adapter.readFile(file.path);
      if (this.editor) {
        this.editor.setContent(text);
        this.editor.focus();
      }

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

    const name = prompt('Введите название заметки:', 'Новая заметка');
    if (!name || name.trim().length === 0) return;

    try {
      this.setSaveStatus('Создание...', true);
      const newFile = await this.adapter.createFile(
        name.trim(),
        `# ${name.trim()}\n\nСоздано: ${new Date().toLocaleString()}\n\n`
      );

      this.files.unshift(newFile);
      this.renderFileList();
      await this.openFile(newFile);
      this.setSaveStatus('Сохранено ✓', false);
    } catch (err: any) {
      console.error('Ошибка создания заметки:', err);
      alert(`Не удалось создать файл: ${err.message}`);
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
