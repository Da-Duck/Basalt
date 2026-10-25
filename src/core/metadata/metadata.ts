import type { FileSystemAdapter } from '../adapter/FileSystemAdapter';

export interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  content: string;
  createdAt: number;
  createdAtISO: string;
  deletedAt: number;
  deletedAtISO: string;
}

export interface NoteCharacteristics {
  icon?: string;
  color?: string;
  createdAt: number;
  createdAtISO: string;
  updatedAt: number;
  updatedAtISO: string;
  tags?: string[];
}

export interface FolderCharacteristics {
  icon?: string;
  createdAt?: number;
  createdAtISO?: string;
}

export interface BasaltVaultMetadata {
  version: number;
  vaultName: string;
  updatedAt: number;
  updatedAtISO: string;
  notes: Record<string, NoteCharacteristics>;
  folders: Record<string, FolderCharacteristics>;
  trash: TrashItem[];
}

const DEFAULT_METADATA: BasaltVaultMetadata = {
  version: 1,
  vaultName: '',
  updatedAt: Date.now(),
  updatedAtISO: new Date().toISOString(),
  notes: {},
  folders: {},
  trash: [],
};

class MetadataManager {
  private data: BasaltVaultMetadata;
  private adapter: FileSystemAdapter | null = null;
  private isSavingToFile: boolean = false;

  constructor() {
    this.data = this.loadLocalBackup();
  }

  // Загрузка резервной копии из localStorage (для быстрой инициализации до открытия папки)
  private loadLocalBackup(): BasaltVaultMetadata {
    try {
      const raw = localStorage.getItem('basalt-metadata');
      if (raw) {
        const parsed = JSON.parse(raw);

        // Поддержка миграции со старого формата (где были плоские customIcons и customColors)
        const notes: Record<string, NoteCharacteristics> = parsed.notes || {};
        const folders: Record<string, FolderCharacteristics> = parsed.folders || {};

        if (parsed.customIcons) {
          for (const [path, icon] of Object.entries(parsed.customIcons as Record<string, string>)) {
            if (path.endsWith('.md') || path.endsWith('.txt')) {
              notes[path] = {
                ...(notes[path] || {
                  createdAt: Date.now(),
                  createdAtISO: new Date().toISOString(),
                  updatedAt: Date.now(),
                  updatedAtISO: new Date().toISOString(),
                }),
                icon,
              };
            } else {
              folders[path] = {
                ...(folders[path] || {
                  createdAt: Date.now(),
                  createdAtISO: new Date().toISOString(),
                }),
                icon,
              };
            }
          }
        }

        if (parsed.customColors) {
          for (const [path, color] of Object.entries(parsed.customColors as Record<string, string>)) {
            notes[path] = {
              ...(notes[path] || {
                createdAt: Date.now(),
                createdAtISO: new Date().toISOString(),
                updatedAt: Date.now(),
                updatedAtISO: new Date().toISOString(),
              }),
              color,
            };
          }
        }

        return {
          version: parsed.version || 1,
          vaultName: parsed.vaultName || '',
          updatedAt: parsed.updatedAt || Date.now(),
          updatedAtISO: parsed.updatedAtISO || new Date().toISOString(),
          notes,
          folders,
          trash: parsed.trash || [],
        };
      }
    } catch (e) {
      console.error('Ошибка чтения локальных метаданных:', e);
    }
    return { ...DEFAULT_METADATA };
  }

  private saveLocalBackup() {
    try {
      localStorage.setItem('basalt-metadata', JSON.stringify(this.data));
    } catch (e) {
      console.error('Ошибка сохранения локального бэкапа метаданных:', e);
    }
  }

  // Привязка файлового адаптера хранилища и чтение .basalt/metadata.json
  public async attachAdapter(adapter: FileSystemAdapter): Promise<void> {
    this.adapter = adapter;

    try {
      const vaultContent = await adapter.readVaultMetadata();
      if (vaultContent) {
        const parsed = JSON.parse(vaultContent);
        this.data = {
          version: parsed.version || 1,
          vaultName: adapter.getVaultName(),
          updatedAt: parsed.updatedAt || Date.now(),
          updatedAtISO: parsed.updatedAtISO || new Date().toISOString(),
          notes: parsed.notes || {},
          folders: parsed.folders || {},
          trash: parsed.trash || [],
        };
        this.saveLocalBackup();
      } else {
        // Файла метаданных ещё нет в хранилище — инициализируем и сохраняем явно
        this.data.vaultName = adapter.getVaultName();
        this.data.updatedAt = Date.now();
        this.data.updatedAtISO = new Date().toISOString();
        await this.saveToVaultFile();
      }
    } catch (err) {
      console.warn('Не удалось загрузить .basalt/metadata.json, используется локальная копия:', err);
    }
  }

  // Сохранение файла метаданных .basalt/metadata.json в папке хранилища
  private async saveToVaultFile(): Promise<void> {
    if (!this.adapter || !this.adapter.isOpen() || this.isSavingToFile) return;

    this.isSavingToFile = true;
    try {
      this.data.vaultName = this.adapter.getVaultName();
      this.data.updatedAt = Date.now();
      this.data.updatedAtISO = new Date().toISOString();

      // Записываем структурированный JSON с отступами в 2 пробела для наглядности
      const formattedJson = JSON.stringify(this.data, null, 2);
      await this.adapter.writeVaultMetadata(formattedJson);
    } catch (err) {
      console.error('Ошибка сохранения .basalt/metadata.json:', err);
    } finally {
      this.isSavingToFile = false;
    }
  }

  private save() {
    this.data.updatedAt = Date.now();
    this.data.updatedAtISO = new Date().toISOString();
    this.saveLocalBackup();
    this.saveToVaultFile().catch(() => {});
  }

  // === Иконки (Заметки и Папки) ===
  public setIcon(path: string, icon: string, isDirectory: boolean = false) {
    if (isDirectory) {
      if (!this.data.folders[path]) {
        this.data.folders[path] = {
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
        };
      }
      this.data.folders[path].icon = icon;
    } else {
      if (!this.data.notes[path]) {
        this.data.notes[path] = {
          createdAt: Date.now(),
          createdAtISO: new Date().toISOString(),
          updatedAt: Date.now(),
          updatedAtISO: new Date().toISOString(),
        };
      }
      this.data.notes[path].icon = icon;
    }
    this.save();
  }

  public getIcon(path: string): string | null {
    if (this.data.notes[path]?.icon) {
      return this.data.notes[path].icon!;
    }
    if (this.data.folders[path]?.icon) {
      return this.data.folders[path].icon!;
    }
    return null;
  }

  public removeIcon(path: string) {
    if (this.data.notes[path]) {
      delete this.data.notes[path].icon;
    }
    if (this.data.folders[path]) {
      delete this.data.folders[path].icon;
    }
    this.save();
  }

  // === Цвета названий заметок ===
  public setColor(path: string, color: string) {
    if (!this.data.notes[path]) {
      this.data.notes[path] = {
        createdAt: Date.now(),
        createdAtISO: new Date().toISOString(),
        updatedAt: Date.now(),
        updatedAtISO: new Date().toISOString(),
      };
    }
    this.data.notes[path].color = color;
    this.save();
  }

  public getColor(path: string): string | null {
    return this.data.notes[path]?.color || null;
  }

  public removeColor(path: string) {
    if (this.data.notes[path]) {
      delete this.data.notes[path].color;
    }
    this.save();
  }

  // === Даты и характеристики заметки ===
  public touchNote(path: string, createdAt?: number) {
    const now = Date.now();
    const existing = this.data.notes[path];

    if (!existing) {
      const created = createdAt || now;
      this.data.notes[path] = {
        createdAt: created,
        createdAtISO: new Date(created).toISOString(),
        updatedAt: now,
        updatedAtISO: new Date(now).toISOString(),
      };
    } else {
      existing.updatedAt = now;
      existing.updatedAtISO = new Date(now).toISOString();
      if (createdAt && !existing.createdAt) {
        existing.createdAt = createdAt;
        existing.createdAtISO = new Date(createdAt).toISOString();
      }
    }
    this.save();
  }

  public getNoteCharacteristics(path: string): NoteCharacteristics | null {
    return this.data.notes[path] || null;
  }

  // === Миграция путей при переименовании или перемещении ===
  public migratePath(oldPath: string, newPath: string, isDirectory: boolean) {
    if (!isDirectory) {
      if (this.data.notes[oldPath]) {
        this.data.notes[newPath] = this.data.notes[oldPath];
        delete this.data.notes[oldPath];
      }
    } else {
      const oldPrefix = `${oldPath}/`;
      const newPrefix = `${newPath}/`;

      if (this.data.folders[oldPath]) {
        this.data.folders[newPath] = this.data.folders[oldPath];
        delete this.data.folders[oldPath];
      }

      // Дочерние папки
      for (const [k, v] of Object.entries(this.data.folders)) {
        if (k.startsWith(oldPrefix)) {
          delete this.data.folders[k];
          this.data.folders[`${newPrefix}${k.slice(oldPrefix.length)}`] = v;
        }
      }

      // Дочерние заметки
      for (const [k, v] of Object.entries(this.data.notes)) {
        if (k.startsWith(oldPrefix)) {
          delete this.data.notes[k];
          this.data.notes[`${newPrefix}${k.slice(oldPrefix.length)}`] = v;
        }
      }
    }
    this.save();
  }

  // === Корзина ===
  public getTrash(): TrashItem[] {
    return [...this.data.trash].sort((a, b) => b.deletedAt - a.deletedAt);
  }

  public addToTrash(item: { name: string; originalPath: string; content: string; createdAt?: number }) {
    const now = Date.now();
    const created = item.createdAt || now - 3600000;

    const trashItem: TrashItem = {
      id: `trash_${now}_${Math.random().toString(36).substring(2, 7)}`,
      name: item.name,
      originalPath: item.originalPath,
      content: item.content,
      createdAt: created,
      createdAtISO: new Date(created).toISOString(),
      deletedAt: now,
      deletedAtISO: new Date(now).toISOString(),
    };

    this.data.trash.unshift(trashItem);
    this.save();
  }

  public restoreFromTrash(id: string): TrashItem | null {
    const idx = this.data.trash.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const [restored] = this.data.trash.splice(idx, 1);
    this.save();
    return restored;
  }

  public deletePermanently(id: string) {
    this.data.trash = this.data.trash.filter(t => t.id !== id);
    this.save();
  }

  public purgeExpired(retentionDays: number): number {
    if (retentionDays <= 0) return 0; // 0 = бессрочно

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const initialCount = this.data.trash.length;

    this.data.trash = this.data.trash.filter(item => item.deletedAt >= cutoff);

    if (this.data.trash.length !== initialCount) {
      this.save();
    }

    return initialCount - this.data.trash.length;
  }
}

export const metadataManager = new MetadataManager();
