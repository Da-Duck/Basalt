import type { FileEntry, FileSystemAdapter } from './FileSystemAdapter';

export class WebFileAdapter implements FileSystemAdapter {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private fileHandles = new Map<string, FileSystemFileHandle>();

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  isOpen(): boolean {
    return this.dirHandle !== null;
  }

  getVaultName(): string {
    return this.dirHandle ? this.dirHandle.name : 'Хранилище не открыто';
  }

  async openVault(): Promise<FileEntry[]> {
    if (!this.isSupported()) {
      throw new Error('Ваш браузер не поддерживает File System Access API. Рекомендуется использовать Chrome, Edge или Chromium.');
    }

    try {
      // Запрос доступа к папке на диске
      this.dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      this.fileHandles.clear();

      return await this.scanDirectory(this.dirHandle!, '');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Пользователь отменил выбор папки
        return [];
      }
      throw err;
    }
  }

  private async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    basePath: string
  ): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];

    // Читаем все элементы в папке
    for await (const entry of (dirHandle as any).values()) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        // Фокусируемся на Markdown-файлах и текстовых заметках
        if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
          const fileHandle = entry as FileSystemFileHandle;
          this.fileHandles.set(entryPath, fileHandle);

          const file = await fileHandle.getFile();
          entries.push({
            name: entry.name,
            path: entryPath,
            isDirectory: false,
            size: file.size,
            lastModified: file.lastModified,
          });
        }
      } else if (entry.kind === 'directory') {
        // Игнорируем служебные папки (например .git, .obsidian, node_modules)
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          entries.push({
            name: entry.name,
            path: entryPath,
            isDirectory: true,
          });

          const subEntries = await this.scanDirectory(entry as FileSystemDirectoryHandle, entryPath);
          entries.push(...subEntries);
        }
      }
    }

    // Сортировка: сначала папки, затем файлы по алфавиту
    return entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  async readFile(path: string): Promise<string> {
    const handle = this.fileHandles.get(path);
    if (!handle) {
      throw new Error(`Файл не найден в хранилище: ${path}`);
    }

    const file = await handle.getFile();
    return await file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const handle = this.fileHandles.get(path);
    if (!handle) {
      throw new Error(`Невозможно сохранить, дескриптор файла отсутствует: ${path}`);
    }

    const writable = await (handle as any).createWritable();
    await writable.write(content);
    await writable.close();
  }

  async createFile(name: string, initialContent: string = '# Новая заметка\n\n'): Promise<FileEntry> {
    if (!this.dirHandle) {
      throw new Error('Хранилище не открыто.');
    }

    const filename = name.endsWith('.md') ? name : `${name}.md`;
    const handle = await this.dirHandle.getFileHandle(filename, { create: true });
    this.fileHandles.set(filename, handle);

    const writable = await (handle as any).createWritable();
    await writable.write(initialContent);
    await writable.close();

    const file = await handle.getFile();
    return {
      name: filename,
      path: filename,
      isDirectory: false,
      size: file.size,
      lastModified: file.lastModified,
    };
  }
}
