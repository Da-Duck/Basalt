export interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  content: string;
  createdAt: number;
  deletedAt: number;
}

export interface BasaltMetadata {
  customIcons: Record<string, string>;
  trash: TrashItem[];
}

const DEFAULT_METADATA: BasaltMetadata = {
  customIcons: {},
  trash: [],
};

class MetadataManager {
  private data: BasaltMetadata;

  constructor() {
    this.data = this.load();
  }

  private load(): BasaltMetadata {
    try {
      const raw = localStorage.getItem('basalt-metadata');
      if (raw) {
        return { ...DEFAULT_METADATA, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Ошибка чтения метаданных:', e);
    }
    return { ...DEFAULT_METADATA };
  }

  private save() {
    try {
      localStorage.setItem('basalt-metadata', JSON.stringify(this.data));
    } catch (e) {
      console.error('Ошибка сохранения метаданных:', e);
    }
  }

  // === Иконки ===
  public setIcon(path: string, icon: string) {
    this.data.customIcons[path] = icon;
    this.save();
  }

  public getIcon(path: string): string | null {
    return this.data.customIcons[path] || null;
  }

  public removeIcon(path: string) {
    delete this.data.customIcons[path];
    this.save();
  }

  // === Корзина ===
  public getTrash(): TrashItem[] {
    return [...this.data.trash].sort((a, b) => b.deletedAt - a.deletedAt);
  }

  public addToTrash(item: { name: string; originalPath: string; content: string; createdAt?: number }) {
    const trashItem: TrashItem = {
      id: `trash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: item.name,
      originalPath: item.originalPath,
      content: item.content,
      createdAt: item.createdAt || Date.now() - 3600000,
      deletedAt: Date.now(),
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
