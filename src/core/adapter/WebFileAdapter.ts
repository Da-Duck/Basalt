import type { FileEntry, FileSystemAdapter } from './FileSystemAdapter';

export class WebFileAdapter implements FileSystemAdapter {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private fileHandles = new Map<string, FileSystemFileHandle>();
  private dirHandles = new Map<string, FileSystemDirectoryHandle>();

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
      this.dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      this.fileHandles.clear();
      this.dirHandles.clear();
      this.dirHandles.set('', this.dirHandle!);

      return await this.scanDirectory(this.dirHandle!, '');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return [];
      }
      throw err;
    }
  }

  async refresh(): Promise<FileEntry[]> {
    if (!this.dirHandle) return [];
    this.fileHandles.clear();
    this.dirHandles.clear();
    this.dirHandles.set('', this.dirHandle);
    return await this.scanDirectory(this.dirHandle, '');
  }

  private async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    basePath: string
  ): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];

    for await (const entry of (dirHandle as any).values()) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
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
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subDirHandle = entry as FileSystemDirectoryHandle;
          this.dirHandles.set(entryPath, subDirHandle);

          entries.push({
            name: entry.name,
            path: entryPath,
            isDirectory: true,
          });

          const subEntries = await this.scanDirectory(subDirHandle, entryPath);
          entries.push(...subEntries);
        }
      }
    }

    return entries;
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

  async createFile(
    name: string,
    initialContent: string = '# Новая заметка\n\n',
    parentPath: string = ''
  ): Promise<FileEntry> {
    if (!this.dirHandle) {
      throw new Error('Хранилище не открыто.');
    }

    const targetDir = parentPath ? this.dirHandles.get(parentPath) : this.dirHandle;
    if (!targetDir) {
      throw new Error(`Целевая папка не найдена: ${parentPath}`);
    }

    const filename = name.endsWith('.md') ? name : `${name}.md`;
    const handle = await targetDir.getFileHandle(filename, { create: true });
    const fullPath = parentPath ? `${parentPath}/${filename}` : filename;

    this.fileHandles.set(fullPath, handle);

    const writable = await (handle as any).createWritable();
    await writable.write(initialContent);
    await writable.close();

    const file = await handle.getFile();
    return {
      name: filename,
      path: fullPath,
      isDirectory: false,
      size: file.size,
      lastModified: file.lastModified,
    };
  }

  async createFolder(name: string, parentPath: string = ''): Promise<FileEntry> {
    if (!this.dirHandle) {
      throw new Error('Хранилище не открыто.');
    }

    const targetDir = parentPath ? this.dirHandles.get(parentPath) : this.dirHandle;
    if (!targetDir) {
      throw new Error(`Целевая папка не найдена: ${parentPath}`);
    }

    const folderName = name.trim();
    const handle = await targetDir.getDirectoryHandle(folderName, { create: true });
    const fullPath = parentPath ? `${parentPath}/${folderName}` : folderName;

    this.dirHandles.set(fullPath, handle);

    return {
      name: folderName,
      path: fullPath,
      isDirectory: true,
    };
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.dirHandle) throw new Error('Хранилище не открыто');

    const parts = path.split('/');
    const filename = parts.pop()!;
    const parentPath = parts.join('/');
    const parentDir = parentPath ? this.dirHandles.get(parentPath) : this.dirHandle;

    if (!parentDir) throw new Error(`Родительская папка не найдена: ${parentPath}`);

    await parentDir.removeEntry(filename);
    this.fileHandles.delete(path);
  }

  async deleteFolder(path: string): Promise<void> {
    if (!this.dirHandle) throw new Error('Хранилище не открыто');

    const parts = path.split('/');
    const folderName = parts.pop()!;
    const parentPath = parts.join('/');
    const parentDir = parentPath ? this.dirHandles.get(parentPath) : this.dirHandle;

    if (!parentDir) throw new Error(`Родительская папка не найдена: ${parentPath}`);

    await parentDir.removeEntry(folderName, { recursive: true });
    this.dirHandles.delete(path);

    // Удаляем все дочерние пути из кэша
    for (const k of Array.from(this.fileHandles.keys())) {
      if (k.startsWith(`${path}/`)) this.fileHandles.delete(k);
    }
    for (const k of Array.from(this.dirHandles.keys())) {
      if (k.startsWith(`${path}/`)) this.dirHandles.delete(k);
    }
  }

  async renameFile(oldPath: string, newName: string): Promise<FileEntry> {
    const handle = this.fileHandles.get(oldPath);
    if (!handle) throw new Error(`Файл не найден: ${oldPath}`);

    const parts = oldPath.split('/');
    const oldFileName = parts.pop()!;
    const parentPath = parts.join('/');
    const cleanName = newName.trim().endsWith('.md') ? newName.trim() : `${newName.trim()}.md`;

    if (cleanName === oldFileName) {
      return {
        name: cleanName,
        path: oldPath,
        isDirectory: false,
      };
    }

    const newPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;

    let movedNative = false;
    if (typeof (handle as any).move === 'function') {
      try {
        await (handle as any).move(cleanName);
        movedNative = true;
      } catch (e) {
        movedNative = false;
      }
    }

    if (!movedNative) {
      const content = await this.readFile(oldPath);
      await this.createFile(cleanName, content, parentPath);
      await this.deleteFile(oldPath);
    }

    await this.refresh();
    const newHandle = this.fileHandles.get(newPath);
    const file = newHandle ? await newHandle.getFile() : undefined;

    return {
      name: cleanName,
      path: newPath,
      isDirectory: false,
      size: file?.size,
      lastModified: file?.lastModified,
    };
  }

  async renameFolder(oldPath: string, newName: string): Promise<FileEntry> {
    const handle = this.dirHandles.get(oldPath);
    if (!handle) throw new Error(`Папка не найдена: ${oldPath}`);

    const parts = oldPath.split('/');
    const oldDirName = parts.pop()!;
    const parentPath = parts.join('/');
    const cleanName = newName.trim();

    if (cleanName === oldDirName) {
      return {
        name: cleanName,
        path: oldPath,
        isDirectory: true,
      };
    }

    const newPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;

    let movedNative = false;
    if (typeof (handle as any).move === 'function') {
      try {
        await (handle as any).move(cleanName);
        movedNative = true;
      } catch (e) {
        movedNative = false;
      }
    }

    if (!movedNative) {
      await this.createFolder(cleanName, parentPath);
      const allFiles = Array.from(this.fileHandles.keys()).filter((p) => p.startsWith(`${oldPath}/`));
      for (const fpath of allFiles) {
        const subRel = fpath.slice(oldPath.length + 1);
        const subParts = subRel.split('/');
        const subFileName = subParts.pop()!;
        const subParent = subParts.length > 0 ? `${newPath}/${subParts.join('/')}` : newPath;

        const content = await this.readFile(fpath);
        await this.createFile(subFileName, content, subParent);
      }
      await this.deleteFolder(oldPath);
    }

    await this.refresh();
    return {
      name: cleanName,
      path: newPath,
      isDirectory: true,
    };
  }

  async moveEntry(oldPath: string, newParentPath: string): Promise<FileEntry> {
    const isDir = this.dirHandles.has(oldPath);
    const parts = oldPath.split('/');
    const entryName = parts[parts.length - 1];

    if (!isDir) {
      // Перемещение файла: читаем, создаём на новом месте, удаляем старый
      const content = await this.readFile(oldPath);
      const newFile = await this.createFile(entryName, content, newParentPath);
      await this.deleteFile(oldPath);
      return newFile;
    } else {
      // Перемещение папки
      const newFolder = await this.createFolder(entryName, newParentPath);
      // Копируем содержимое рекурсивно
      const allFiles = Array.from(this.fileHandles.keys()).filter(p => p.startsWith(`${oldPath}/`));
      for (const fpath of allFiles) {
        const subRel = fpath.slice(oldPath.length + 1);
        const subParts = subRel.split('/');
        const subFileName = subParts.pop()!;
        const subParent = subParts.length > 0 ? `${newFolder.path}/${subParts.join('/')}` : newFolder.path;

        const content = await this.readFile(fpath);
        await this.createFile(subFileName, content, subParent);
      }
      await this.deleteFolder(oldPath);
      return newFolder;
    }
  }

  async readVaultMetadata(): Promise<string | null> {
    if (!this.dirHandle) return null;
    try {
      const dotDir = await this.dirHandle.getDirectoryHandle('.basalt', { create: false });
      const fileHandle = await dotDir.getFileHandle('metadata.json', { create: false });
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async writeVaultMetadata(content: string): Promise<void> {
    if (!this.dirHandle) return;
    try {
      const dotDir = await this.dirHandle.getDirectoryHandle('.basalt', { create: true });
      const fileHandle = await dotDir.getFileHandle('metadata.json', { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(content);
      await writable.close();
    } catch (err) {
      console.warn('Не удалось записать .basalt/metadata.json:', err);
    }
  }
}
