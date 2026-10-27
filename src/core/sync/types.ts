export interface CloudFileInfo {
  path: string; // Относительный путь в хранилище, например "Notes/Idea.md" или ".basalt/metadata.json"
  name: string;
  size: number;
  lastModified: number; // Таймштамп в миллисекундах
  isDirectory: boolean;
  hash?: string;
}

export interface CloudAccountInfo {
  displayName?: string;
  login?: string;
  totalSpace?: number;
  usedSpace?: number;
}

export interface CloudProvider {
  id: 'yandex';
  name: string;
  isAuthenticated(): boolean;
  testConnection(): Promise<{ success: boolean; error?: string; account?: CloudAccountInfo }>;
  listFiles(remotePrefix?: string): Promise<CloudFileInfo[]>;
  readFile(remotePath: string): Promise<string>;
  writeFile(remotePath: string, content: string): Promise<void>;
  deleteFile(remotePath: string): Promise<void>;
  createFolder(remotePath: string): Promise<void>;
}

export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'success' | 'error';

export interface SyncProgress {
  stage: string;
  current: number;
  total: number;
  filename?: string;
}

export interface SyncResult {
  uploaded: string[];
  downloaded: string[];
  deleted: string[];
  conflicts: string[];
  errors: string[];
  timestamp: number;
}

export interface SyncConfig {
  enabled: boolean;
  provider: 'yandex';
  autoSyncOnSave: boolean;

  // Яндекс Диск
  yandexToken: string;
  yandexRemotePath: string; // По умолчанию "disk:/Basalt"

  // Состояние
  lastSyncTime: number | null;
  lastSyncStatus: 'idle' | 'success' | 'error';
  lastSyncError?: string;
  lastSyncStats?: {
    uploaded: number;
    downloaded: number;
    deleted: number;
  };
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  provider: 'yandex',
  autoSyncOnSave: false,
  yandexToken: '',
  yandexRemotePath: 'disk:/Basalt',
  lastSyncTime: null,
  lastSyncStatus: 'idle',
};
