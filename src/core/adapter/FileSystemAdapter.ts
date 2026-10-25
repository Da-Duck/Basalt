export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: number;
}

export interface FileSystemAdapter {
  isSupported(): boolean;
  openVault(): Promise<FileEntry[]>;
  refresh(): Promise<FileEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createFile(name: string, initialContent?: string, parentPath?: string): Promise<FileEntry>;
  createFolder(name: string, parentPath?: string): Promise<FileEntry>;
  deleteFile(path: string): Promise<void>;
  deleteFolder(path: string): Promise<void>;
  moveEntry(oldPath: string, newParentPath: string): Promise<FileEntry>;
  getVaultName(): string;
  isOpen(): boolean;
}
