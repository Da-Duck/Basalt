import type { FileSystemAdapter } from '../adapter/FileSystemAdapter';
import type {
  CloudProvider,
  SyncConfig,
  SyncProgress,
  SyncResult,
  SyncStatus,
  CloudFileInfo,
} from './types';
import { DEFAULT_SYNC_CONFIG } from './types';
import { YandexDiskProvider } from './YandexDiskProvider';

interface ManifestEntry {
  lastModified: number;
  size: number;
  syncedAt: number;
}

export class SyncEngine {
  private adapter: FileSystemAdapter;
  private config: SyncConfig;
  private currentProvider: CloudProvider | null = null;
  private currentStatus: SyncStatus = 'idle';
  private listeners: Array<(status: SyncStatus, progress?: SyncProgress) => void> = [];

  constructor(adapter: FileSystemAdapter) {
    this.adapter = adapter;
    this.config = this.loadConfig();
    this.updateProvider();
  }

  public subscribe(fn: (status: SyncStatus, progress?: SyncProgress) => void) {
    this.listeners.push(fn);
    fn(this.currentStatus);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(status: SyncStatus, progress?: SyncProgress) {
    this.currentStatus = status;
    this.listeners.forEach((fn) => fn(status, progress));
  }

  public getStatus(): SyncStatus {
    return this.currentStatus;
  }

  public getConfig(): SyncConfig {
    return { ...this.config };
  }

  public saveConfig(partial: Partial<SyncConfig>) {
    this.config = { ...this.config, ...partial };
    try {
      localStorage.setItem('basalt-sync-config', JSON.stringify(this.config));
    } catch (e) {
      console.error('Ошибка сохранения настроек синхронизации:', e);
    }
    this.updateProvider();
  }

  private loadConfig(): SyncConfig {
    try {
      const raw = localStorage.getItem('basalt-sync-config');
      if (raw) {
        return { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Ошибка загрузки настроек синхронизации:', e);
    }
    return { ...DEFAULT_SYNC_CONFIG };
  }

  private updateProvider() {
    this.currentProvider = new YandexDiskProvider(
      this.config.yandexToken,
      this.config.yandexRemotePath || 'disk:/Basalt'
    );
  }

  public getProvider(): CloudProvider | null {
    return this.currentProvider;
  }

  public async testConnection() {
    this.updateProvider();
    if (!this.currentProvider) {
      return { success: false, error: 'Облачный провайдер не настроен' };
    }
    return await this.currentProvider.testConnection();
  }

  private getManifestKey(): string {
    const vaultName = this.adapter.getVaultName() || 'default';
    return `basalt-sync-manifest-${vaultName}`;
  }

  private loadManifest(): Record<string, ManifestEntry> {
    try {
      const raw = localStorage.getItem(this.getManifestKey());
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Не удалось прочитать манифест синхронизации:', e);
    }
    return {};
  }

  private saveManifest(manifest: Record<string, ManifestEntry>) {
    try {
      localStorage.setItem(this.getManifestKey(), JSON.stringify(manifest));
    } catch (e) {
      console.warn('Не удалось сохранить манифест синхронизации:', e);
    }
  }

  /**
   * Запуск двусторонней синхронизации
   */
  public async sync(): Promise<SyncResult> {
    if (this.currentStatus === 'syncing') {
      throw new Error('Синхронизация уже выполняется');
    }

    if (!this.adapter.isOpen()) {
      throw new Error('Локальное хранилище не открыто.');
    }

    this.updateProvider();
    if (!this.currentProvider || !this.currentProvider.isAuthenticated()) {
      throw new Error('Облачное хранилище не настроено или не авторизовано.');
    }

    this.notify('syncing', { stage: 'Проверка подключения...', current: 0, total: 1 });

    const result: SyncResult = {
      uploaded: [],
      downloaded: [],
      deleted: [],
      conflicts: [],
      errors: [],
      timestamp: Date.now(),
    };

    try {
      // 1. Проверяем связь с облаком
      const test = await this.currentProvider.testConnection();
      if (!test.success) {
        throw new Error(test.error || 'Не удалось подключиться к облаку.');
      }

      // 2. Сканируем локальное хранилище
      this.notify('syncing', { stage: 'Сканирование локальных файлов...', current: 0, total: 1 });
      const localEntries = await this.adapter.refresh();

      // Фильтруем: исключаем корзину и системные временные файлы
      const localFiles = localEntries.filter((e) => {
        if (e.isDirectory) return false;
        if (e.path.startsWith('.basalt/trash/')) return false;
        if (e.path.startsWith('.git/')) return false;
        if (e.name.startsWith('.')) return false;
        return true;
      });

      const localMap = new Map<string, { path: string; lastModified: number; size: number }>();
      localFiles.forEach((f) => {
        localMap.set(f.path, {
          path: f.path,
          lastModified: f.lastModified || Date.now(),
          size: f.size || 0,
        });
      });

      // 3. Сканируем удаленное облако
      this.notify('syncing', { stage: 'Получение списка файлов из облака...', current: 0, total: 1 });
      const remoteFiles = await this.currentProvider.listFiles();
      const remoteMap = new Map<string, CloudFileInfo>();

      remoteFiles.forEach((rf) => {
        if (!rf.isDirectory) {
          remoteMap.set(rf.path, rf);
        }
      });

      // 4. Двусторонняя синхронизация метаданных (иконки и цвета заметок/папок)
      await this.syncMetadata(remoteMap, result);

      // 5. Загружаем предыдущий манифест
      const manifest = this.loadManifest();
      const newManifest: Record<string, ManifestEntry> = { ...manifest };

      // Множество всех путей (метаданные синхронизируются отдельно и исключаются)
      const allPaths = new Set<string>([
        ...localMap.keys(),
        ...remoteMap.keys(),
        ...Object.keys(manifest),
      ]);
      allPaths.delete('.basalt/metadata.json');

      const totalItems = allPaths.size;
      let processed = 0;

      // 6. Двустороннее сопоставление файлов заметок
      for (const relPath of allPaths) {
        processed++;
        this.notify('syncing', {
          stage: `Синхронизация: ${relPath}`,
          current: processed,
          total: totalItems,
          filename: relPath,
        });

        const local = localMap.get(relPath);
        const remote = remoteMap.get(relPath);
        const prev = manifest[relPath];

        try {
          // Случай 1: Файл есть и локально, и в облаке
          if (local && remote) {
            const timeDiff = Math.abs(local.lastModified - remote.lastModified);
            // Если разница менее 2 секунд — считаем файлы синхронизированными
            if (timeDiff <= 2000 && local.size === remote.size) {
              newManifest[relPath] = {
                lastModified: local.lastModified,
                size: local.size,
                syncedAt: Date.now(),
              };
              continue;
            }

            // Локальный новее -> Загружаем в облако
            if (local.lastModified > remote.lastModified) {
              const content = await this.readFileLocal(relPath);
              await this.currentProvider.writeFile(relPath, content);
              result.uploaded.push(relPath);
              newManifest[relPath] = {
                lastModified: local.lastModified,
                size: local.size,
                syncedAt: Date.now(),
              };
            }
            // Удаленный новее -> Скачиваем из облака
            else {
              const content = await this.currentProvider.readFile(relPath);
              await this.writeFileLocal(relPath, content);
              result.downloaded.push(relPath);
              newManifest[relPath] = {
                lastModified: remote.lastModified,
                size: remote.size,
                syncedAt: Date.now(),
              };
            }
          }
          // Случай 2: Файл есть только локально
          else if (local && !remote) {
            // Если файл раньше был в манифесте — значит его удалили в облаке
            if (prev) {
              await this.deleteFileLocal(relPath);
              delete newManifest[relPath];
              result.deleted.push(relPath);
            }
            // Иначе это новый локальный файл -> Загружаем в облако
            else {
              const content = await this.readFileLocal(relPath);
              await this.currentProvider.writeFile(relPath, content);
              result.uploaded.push(relPath);
              newManifest[relPath] = {
                lastModified: local.lastModified,
                size: local.size,
                syncedAt: Date.now(),
              };
            }
          }
          // Случай 3: Файл есть только в облаке
          else if (!local && remote) {
            // Если файл раньше был в манифесте — значит его удалили локально
            if (prev) {
              await this.currentProvider.deleteFile(relPath);
              delete newManifest[relPath];
              result.deleted.push(relPath);
            }
            // Иначе это новый удаленный файл -> Скачиваем в локальное хранилище
            else {
              const content = await this.currentProvider.readFile(relPath);
              await this.writeFileLocal(relPath, content);
              result.downloaded.push(relPath);
              newManifest[relPath] = {
                lastModified: remote.lastModified,
                size: remote.size,
                syncedAt: Date.now(),
              };
            }
          }
          // Случай 4: Файла нет ни локально, ни в облаке, но есть в старом манифесте
          else if (!local && !remote && prev) {
            delete newManifest[relPath];
          }
        } catch (fileErr: any) {
          console.error(`Ошибка при синхронизации ${relPath}:`, fileErr);
          result.errors.push(`${relPath}: ${fileErr.message}`);
        }
      }

      // 6. Сохраняем обновленный манифест и настройки
      this.saveManifest(newManifest);

      this.saveConfig({
        lastSyncTime: Date.now(),
        lastSyncStatus: result.errors.length > 0 ? 'error' : 'success',
        lastSyncError: result.errors.length > 0 ? result.errors[0] : undefined,
        lastSyncStats: {
          uploaded: result.uploaded.length,
          downloaded: result.downloaded.length,
          deleted: result.deleted.length,
        },
      });

      // 7. Обновляем локальное дерево файлов
      await this.adapter.refresh();

      this.notify(result.errors.length > 0 ? 'error' : 'success');
      return result;
    } catch (err: any) {
      console.error('Критическая ошибка синхронизации:', err);
      this.saveConfig({
        lastSyncTime: Date.now(),
        lastSyncStatus: 'error',
        lastSyncError: err.message,
      });
      this.notify('error');
      throw err;
    }
  }

  private async readFileLocal(relPath: string): Promise<string> {
    if (relPath === '.basalt/metadata.json') {
      const meta = await this.adapter.readVaultMetadata();
      return meta || '{}';
    }
    return await this.adapter.readFile(relPath);
  }

  private async writeFileLocal(relPath: string, content: string): Promise<void> {
    if (relPath === '.basalt/metadata.json') {
      await this.adapter.writeVaultMetadata(content);
      return;
    }
    await this.adapter.ensureFile(relPath, content);
  }

  private async deleteFileLocal(relPath: string): Promise<void> {
    if (relPath === '.basalt/metadata.json') return;
    try {
      await this.adapter.deleteFile(relPath);
    } catch (e) {
      console.warn(`Не удалось удалить локальный файл ${relPath}:`, e);
    }
  }

  /**
   * Интеллектуальная двусторонняя синхронизация метаданных заметок и папок (.basalt/metadata.json)
   * Объединяет иконки, цвета и структуру без потери данных на обеих сторонах
   */
  private async syncMetadata(remoteMap: Map<string, CloudFileInfo>, result: SyncResult): Promise<void> {
    if (!this.currentProvider) return;

    const META_PATH = '.basalt/metadata.json';
    this.notify('syncing', { stage: 'Синхронизация метаданных (иконки и цвета)...', current: 0, total: 1 });

    try {
      let localContent: string | null = null;
      try {
        localContent = await this.adapter.readVaultMetadata();
      } catch (err) {
        console.warn('Не удалось прочитать локальные метаданные:', err);
      }

      let remoteContent: string | null = null;
      const remoteInfo = remoteMap.get(META_PATH);
      if (remoteInfo) {
        try {
          remoteContent = await this.currentProvider.readFile(META_PATH);
        } catch (err) {
          console.warn('Не удалось прочитать метаданные из облака:', err);
        }
      }

      // Случай 1: Метаданные есть и локально, и в облаке -> Объединяем (Merge)
      if (localContent && remoteContent) {
        let localData: any = {};
        let remoteData: any = {};

        try { localData = JSON.parse(localContent); } catch {}
        try { remoteData = JSON.parse(remoteContent); } catch {}

        const mergedNotes: Record<string, any> = {
          ...(remoteData.notes || {}),
          ...(localData.notes || {}),
        };

        // Для заметок, присутствующих на обеих сторонах: выбираем версию с более поздним updatedAt
        const allNoteKeys = new Set([
          ...Object.keys(localData.notes || {}),
          ...Object.keys(remoteData.notes || {}),
        ]);
        for (const key of allNoteKeys) {
          const lNote = localData.notes?.[key];
          const rNote = remoteData.notes?.[key];
          if (lNote && rNote) {
            const lHasVisual = Boolean(lNote.icon || lNote.color);
            const rHasVisual = Boolean(rNote.icon || rNote.color);

            if (lHasVisual && !rHasVisual) {
              mergedNotes[key] = { ...rNote, ...lNote };
            } else if (!lHasVisual && rHasVisual) {
              mergedNotes[key] = { ...lNote, ...rNote };
            } else {
              mergedNotes[key] = (lNote.updatedAt || 0) >= (rNote.updatedAt || 0) ? lNote : rNote;
            }
          } else if (lNote) {
            mergedNotes[key] = lNote;
          } else if (rNote) {
            mergedNotes[key] = rNote;
          }
        }

        // Для папок: объединяем иконки
        const mergedFolders: Record<string, any> = {
          ...(remoteData.folders || {}),
          ...(localData.folders || {}),
        };
        const allFolderKeys = new Set([
          ...Object.keys(localData.folders || {}),
          ...Object.keys(remoteData.folders || {}),
        ]);
        for (const key of allFolderKeys) {
          const lFolder = localData.folders?.[key];
          const rFolder = remoteData.folders?.[key];
          if (lFolder && rFolder) {
            mergedFolders[key] = lFolder.icon ? lFolder : rFolder;
          }
        }

        // Корзина: объединение без дубликатов по ID
        const trashMap = new Map<string, any>();
        (remoteData.trash || []).forEach((item: any) => { if (item.id) trashMap.set(item.id, item); });
        (localData.trash || []).forEach((item: any) => { if (item.id) trashMap.set(item.id, item); });

        const maxUpdated = Math.max(
          localData.updatedAt || 0,
          remoteData.updatedAt || 0,
          Date.now()
        );

        const mergedData = {
          version: Math.max(localData.version || 1, remoteData.version || 1),
          vaultName: this.adapter.getVaultName() || localData.vaultName || remoteData.vaultName || '',
          updatedAt: maxUpdated,
          updatedAtISO: new Date(maxUpdated).toISOString(),
          notes: mergedNotes,
          folders: mergedFolders,
          trash: Array.from(trashMap.values()),
        };

        const mergedString = JSON.stringify(mergedData, null, 2);

        // Записываем локально
        await this.adapter.writeVaultMetadata(mergedString);

        // Записываем в облако
        await this.currentProvider.writeFile(META_PATH, mergedString);

        result.uploaded.push(META_PATH);
        result.downloaded.push(META_PATH);
      }
      // Случай 2: Метаданные есть только локально -> Выгружаем в облако
      else if (localContent && !remoteContent) {
        await this.currentProvider.writeFile(META_PATH, localContent);
        result.uploaded.push(META_PATH);
      }
      // Случай 3: Метаданные есть только в облаке -> Скачиваем локально
      else if (!localContent && remoteContent) {
        await this.adapter.writeVaultMetadata(remoteContent);
        result.downloaded.push(META_PATH);
      }
    } catch (metaErr: any) {
      console.error('Ошибка синхронизации метаданных:', metaErr);
      result.errors.push(`Метаданные: ${metaErr.message}`);
    }
  }
}
