import type { CloudFileInfo, CloudProvider, CloudAccountInfo } from './types';

export class YandexDiskProvider implements CloudProvider {
  public id: 'yandex' = 'yandex';
  public name = 'Яндекс Диск';

  private token: string;
  private remoteRoot: string;
  private baseUrl = 'https://cloud-api.yandex.net/v1/disk';

  constructor(token: string, remoteRoot: string = 'disk:/Basalt') {
    this.token = token.trim();
    this.remoteRoot = remoteRoot.trim() || 'disk:/Basalt';
  }

  public isAuthenticated(): boolean {
    return Boolean(this.token && this.token.length > 5);
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `OAuth ${this.token}`,
      Accept: 'application/json',
    };
  }

  private getRemoteFullPath(relPath: string): string {
    const cleanRel = relPath.replace(/^\/+/, '');
    const cleanRoot = this.remoteRoot.replace(/\/+$/, '');
    return cleanRel ? `${cleanRoot}/${cleanRel}` : cleanRoot;
  }

  public async testConnection(): Promise<{ success: boolean; error?: string; account?: CloudAccountInfo }> {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Токен авторизации не указан' };
    }

    try {
      const res = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        if (res.status === 401) {
          return { success: false, error: 'Неверный OAuth-токен Яндекс Диска (401 Unauthorized)' };
        }
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.message || `Ошибка сервера: HTTP ${res.status}` };
      }

      const data = await res.json();
      return {
        success: true,
        account: {
          displayName: data.user?.display_name || data.user?.login || 'Пользователь',
          login: data.user?.login,
          totalSpace: data.total_space,
          usedSpace: data.used_space,
        },
      };
    } catch (err: any) {
      return { success: false, error: `Ошибка сети при подключении к Яндекс Диску: ${err.message}` };
    }
  }

  /**
   * Гарантирует создание удаленной директории на Яндекс Диске со всеми родительскими папками
   */
  public async createFolder(relPath: string): Promise<void> {
    const fullPath = this.getRemoteFullPath(relPath);
    await this.ensureRemoteFolder(fullPath);
  }

  private async ensureRemoteFolder(fullPath: string): Promise<void> {
    // fullPath имеет вид "disk:/Basalt/Folder1/Subfolder"
    const prefixMatch = fullPath.match(/^(disk:|app:)\/?(.*)$/);
    if (!prefixMatch) return;

    const scheme = prefixMatch[1];
    const pathParts = prefixMatch[2].split('/').filter(Boolean);

    let current = scheme;
    for (const part of pathParts) {
      current = `${current}/${part}`;
      try {
        const res = await fetch(`${this.baseUrl}/resources?path=${encodeURIComponent(current)}`, {
          method: 'PUT',
          headers: this.getHeaders(),
        });
        // 201 Created — создано; 409 Conflict — уже существует
        if (!res.ok && res.status !== 409) {
          const errData = await res.json().catch(() => ({}));
          console.warn(`Предупреждение при создании папки ${current}:`, errData);
        }
      } catch (err) {
        console.warn(`Ошибка при проверке папки ${current}:`, err);
      }
    }
  }

  /**
   * Рекурсивное получение списка всех файлов в удаленном хранилище
   */
  public async listFiles(remotePrefix: string = ''): Promise<CloudFileInfo[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Токен Яндекс Диска не задан.');
    }

    const startPath = this.getRemoteFullPath(remotePrefix);
    const cleanRoot = this.remoteRoot.replace(/\/+$/, '');
    const results: CloudFileInfo[] = [];

    const traverse = async (currentPath: string) => {
      const url = `${this.baseUrl}/resources?path=${encodeURIComponent(currentPath)}&limit=1000`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        // Если корневой папки еще нет — создаем ее
        if (res.status === 404 && currentPath === startPath) {
          await this.ensureRemoteFolder(startPath);
          return;
        }
        throw new Error(`Ошибка получения списка файлов (${res.status}): ${res.statusText}`);
      }

      const data = await res.json();
      const items = data._embedded?.items || [];

      for (const item of items) {
        const itemFullPath: string = item.path;
        let relPath = itemFullPath;
        if (relPath.startsWith(cleanRoot)) {
          relPath = relPath.slice(cleanRoot.length).replace(/^\/+/, '');
        }

        const isDir = item.type === 'dir';
        const lastModified = item.modified ? new Date(item.modified).getTime() : Date.now();

        results.push({
          path: relPath,
          name: item.name,
          size: item.size || 0,
          lastModified,
          isDirectory: isDir,
          hash: item.sha256 || item.md5,
        });

        if (isDir) {
          await traverse(itemFullPath);
        }
      }
    };

    await traverse(startPath);
    return results;
  }

  /**
   * Чтение содержимого файла с Яндекс Диска
   */
  public async readFile(relPath: string): Promise<string> {
    const fullPath = this.getRemoteFullPath(relPath);
    const url = `${this.baseUrl}/resources/download?path=${encodeURIComponent(fullPath)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Не удалось получить ссылку на скачивание ${relPath} (HTTP ${res.status})`);
    }

    const data = await res.json();
    const downloadHref: string = data.href;

    const fileRes = await fetch(downloadHref);
    if (!fileRes.ok) {
      throw new Error(`Не удалось скачать файл ${relPath} (HTTP ${fileRes.status})`);
    }

    return await fileRes.text();
  }

  /**
   * Запись/обновление файла на Яндекс Диске
   */
  public async writeFile(relPath: string, content: string): Promise<void> {
    const fullPath = this.getRemoteFullPath(relPath);

    // Убеждаемся, что родительский каталог существует
    const lastSlash = fullPath.lastIndexOf('/');
    if (lastSlash > fullPath.indexOf(':')) {
      const parentDir = fullPath.slice(0, lastSlash);
      await this.ensureRemoteFolder(parentDir);
    }

    const uploadUrlEndpoint = `${this.baseUrl}/resources/upload?path=${encodeURIComponent(fullPath)}&overwrite=true`;
    const res = await fetch(uploadUrlEndpoint, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Ошибка запроса на загрузку ${relPath}: ${err.message || res.statusText}`);
    }

    const data = await res.json();
    const uploadHref: string = data.href;

    const uploadRes = await fetch(uploadHref, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: content,
    });

    if (!uploadRes.ok && uploadRes.status !== 201 && uploadRes.status !== 202) {
      throw new Error(`Ошибка выгрузки файла ${relPath}: HTTP ${uploadRes.status}`);
    }
  }

  /**
   * Удаление файла с Яндекс Диска
   */
  public async deleteFile(relPath: string): Promise<void> {
    const fullPath = this.getRemoteFullPath(relPath);
    const url = `${this.baseUrl}/resources?path=${encodeURIComponent(fullPath)}&permanently=false`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    // 404 означает, что файл уже удален
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Ошибка удаления файла ${relPath}: ${err.message || res.statusText}`);
    }
  }
}
