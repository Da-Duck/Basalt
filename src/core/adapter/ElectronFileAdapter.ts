import type { FileEntry, FileSystemAdapter } from './FileSystemAdapter';

interface BasaltDesktopApi {
  isDesktop: boolean;
  openDirectoryDialog: () => Promise<{ path: string; name: string } | null>;
  getLastVault: () => Promise<{ path: string; name: string } | null>;
  setLastVault: (vaultPath: string) => Promise<boolean>;
  scanDirectory: (vaultPath: string) => Promise<FileEntry[]>;
  readFile: (vaultPath: string, relPath: string) => Promise<string>;
  writeFile: (vaultPath: string, relPath: string, content: string) => Promise<boolean>;
  ensureFile: (vaultPath: string, relPath: string, content: string) => Promise<boolean>;
  createFile: (vaultPath: string, relPath: string, content: string) => Promise<FileEntry>;
  createFolder: (vaultPath: string, relPath: string) => Promise<FileEntry>;
  deleteFile: (vaultPath: string, relPath: string) => Promise<boolean>;
  deleteFolder: (vaultPath: string, relPath: string) => Promise<boolean>;
  renameFile: (vaultPath: string, oldRelPath: string, newName: string) => Promise<FileEntry>;
  renameFolder: (vaultPath: string, oldRelPath: string, newName: string) => Promise<FileEntry>;
  moveEntry: (vaultPath: string, oldRelPath: string, newParentRelPath: string) => Promise<FileEntry>;
  readVaultMetadata: (vaultPath: string) => Promise<string | null>;
  writeVaultMetadata: (vaultPath: string, content: string) => Promise<boolean>;
}

declare global {
  interface Window {
    basaltDesktop?: BasaltDesktopApi;
  }
}

export class ElectronFileAdapter implements FileSystemAdapter {
  private vaultPath: string | null = null;
  private vaultName: string = '';

  private get desktop(): BasaltDesktopApi {
    if (!window.basaltDesktop) {
      throw new Error('Electron Desktop API недоступен.');
    }
    return window.basaltDesktop;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(window.basaltDesktop?.isDesktop);
  }

  isOpen(): boolean {
    return Boolean(this.vaultPath);
  }

  getVaultName(): string {
    return this.vaultName || 'Хранилище не открыто';
  }

  getVaultPath(): string | null {
    return this.vaultPath;
  }

  async getLastVault(): Promise<{ path: string; name: string } | null> {
    if (!this.isSupported()) return null;
    return await this.desktop.getLastVault();
  }

  async openVaultPath(targetPath: string, targetName?: string): Promise<FileEntry[]> {
    this.vaultPath = targetPath;
    this.vaultName = targetName || targetPath.split(/[\\/]/).pop() || 'Хранилище';
    return await this.refresh();
  }

  async openVault(): Promise<FileEntry[]> {
    const res = await this.desktop.openDirectoryDialog();
    if (!res) {
      return [];
    }
    this.vaultPath = res.path;
    this.vaultName = res.name;
    return await this.refresh();
  }

  async refresh(): Promise<FileEntry[]> {
    if (!this.vaultPath) return [];
    return await this.desktop.scanDirectory(this.vaultPath);
  }

  async readFile(path: string): Promise<string> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    return await this.desktop.readFile(this.vaultPath, path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    await this.desktop.writeFile(this.vaultPath, path, content);
  }

  async ensureFile(path: string, content: string): Promise<void> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    await this.desktop.ensureFile(this.vaultPath, path, content);
  }

  async createFile(
    name: string,
    initialContent: string = '# Новая заметка\n\n',
    parentPath: string = ''
  ): Promise<FileEntry> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    const cleanName = name.trim();
    const withExt = cleanName.endsWith('.md') || cleanName.endsWith('.txt') ? cleanName : `${cleanName}.md`;
    const relPath = parentPath ? `${parentPath}/${withExt}` : withExt;
    return await this.desktop.createFile(this.vaultPath, relPath, initialContent);
  }

  async createFolder(name: string, parentPath: string = ''): Promise<FileEntry> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    const cleanName = name.trim().replace(/[\\/]/g, '_');
    const relPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;
    return await this.desktop.createFolder(this.vaultPath, relPath);
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    await this.desktop.deleteFile(this.vaultPath, path);
  }

  async deleteFolder(path: string): Promise<void> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    await this.desktop.deleteFolder(this.vaultPath, path);
  }

  async renameFile(oldPath: string, newName: string): Promise<FileEntry> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    const cleanName = newName.trim();
    const withExt = cleanName.endsWith('.md') || cleanName.endsWith('.txt') ? cleanName : `${cleanName}.md`;
    return await this.desktop.renameFile(this.vaultPath, oldPath, withExt);
  }

  async renameFolder(oldPath: string, newName: string): Promise<FileEntry> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    const cleanName = newName.trim().replace(/[\\/]/g, '_');
    return await this.desktop.renameFolder(this.vaultPath, oldPath, cleanName);
  }

  async moveEntry(oldPath: string, newParentPath: string): Promise<FileEntry> {
    if (!this.vaultPath) throw new Error('Хранилище не открыто.');
    return await this.desktop.moveEntry(this.vaultPath, oldPath, newParentPath);
  }

  async readVaultMetadata(): Promise<string | null> {
    if (!this.vaultPath) return null;
    return await this.desktop.readVaultMetadata(this.vaultPath);
  }

  async writeVaultMetadata(content: string): Promise<void> {
    if (!this.vaultPath) return;
    await this.desktop.writeVaultMetadata(this.vaultPath, content);
  }
}
