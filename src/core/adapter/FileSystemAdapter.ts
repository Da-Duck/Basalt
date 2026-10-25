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
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  createFile(name: string, initialContent?: string): Promise<FileEntry>;
  getVaultName(): string;
  isOpen(): boolean;
}
