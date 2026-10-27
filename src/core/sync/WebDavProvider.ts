import type { CloudFileInfo, CloudProvider, CloudAccountInfo } from './types';

export class WebDavProvider implements CloudProvider {
  public id: 'webdav' = 'webdav';
  public name = 'WebDAV (Nextcloud / Сервер)';

  private serverUrl: string;
  private username: string;
  private password: string;
  private remoteRoot: string;

  constructor(serverUrl: string, username: string, password: string, remoteRoot: string = '/Basalt') {
    this.serverUrl = serverUrl.trim().replace(/\/+$/, '');
    this.username = username.trim();
    this.password = password.trim();
    this.remoteRoot = remoteRoot.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  }

  public isAuthenticated(): boolean {
    return Boolean(this.serverUrl && this.username && this.password);
  }

  private getAuthHeader(): string {
    return 'Basic ' + btoa(`${this.username}:${this.password}`);
  }

  private getHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: this.getAuthHeader(),
      ...extra,
    };
  }

  private getRemoteUrl(relPath: string): string {
    const cleanRel = relPath.replace(/^\/+/, '');
    const fullRemotePath = this.remoteRoot
      ? (cleanRel ? `${this.remoteRoot}/${cleanRel}` : this.remoteRoot)
      : cleanRel;
    return `${this.serverUrl}/${fullRemotePath}`;
  }

  public async testConnection(): Promise<{ success: boolean; error?: string; account?: CloudAccountInfo }> {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Заполните URL сервера, логин и пароль WebDAV.' };
    }

    try {
      const res = await fetch(this.serverUrl, {
        method: 'PROPFIND',
        headers: this.getHeaders({ Depth: '0' }),
      });

      if (res.status === 401) {
        return { success: false, error: 'Неверный логин или пароль WebDAV (401 Unauthorized).' };
      }

      if (!res.ok && res.status !== 207) {
        return { success: false, error: `Ошибка подключения к WebDAV: HTTP ${res.status}` };
      }

      return {
        success: true,
        account: {
          displayName: this.username,
          login: this.username,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Не удалось связаться с WebDAV сервером (возможно, заблокировано CORS в браузере): ${err.message}`,
      };
    }
  }

  public async createFolder(relPath: string): Promise<void> {
    const url = this.getRemoteUrl(relPath);
    try {
      const res = await fetch(url, {
        method: 'MKCOL',
        headers: this.getHeaders(),
      });
      // 201 Created — успешно, 405 Method Not Allowed — уже существует
      if (!res.ok && res.status !== 405) {
        console.warn(`MKCOL ${url} status: ${res.status}`);
      }
    } catch (err) {
      console.warn(`Ошибка MKCOL:`, err);
    }
  }

  public async listFiles(remotePrefix: string = ''): Promise<CloudFileInfo[]> {
    const url = this.getRemoteUrl(remotePrefix);
    const res = await fetch(url, {
      method: 'PROPFIND',
      headers: this.getHeaders({
        Depth: 'infinity',
        'Content-Type': 'application/xml; charset=utf-8',
      }),
    });

    if (res.status === 404) {
      // Корневой каталог отсутствует, создаем его
      await this.createFolder(remotePrefix);
      return [];
    }

    if (!res.ok && res.status !== 207) {
      throw new Error(`Ошибка получения списка файлов по WebDAV: HTTP ${res.status}`);
    }

    const xmlText = await res.text();
    return this.parseWebDavXml(xmlText);
  }

  private parseWebDavXml(xml: string): CloudFileInfo[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const responses = doc.querySelectorAll('response, d\\:response, D\\:response');

    const results: CloudFileInfo[] = [];
    const rootUrlPath = new URL(this.getRemoteUrl('')).pathname.replace(/\/+$/, '');

    responses.forEach((resp) => {
      const hrefEl = resp.querySelector('href, d\\:href, D\\:href');
      if (!hrefEl) return;

      const rawHref = decodeURIComponent(hrefEl.textContent || '').replace(/\/+$/, '');
      if (rawHref === rootUrlPath) return; // Пропускаем сам корень

      let relPath = rawHref;
      if (relPath.startsWith(rootUrlPath)) {
        relPath = relPath.slice(rootUrlPath.length).replace(/^\/+/, '');
      }

      if (!relPath) return;

      const isDir = Boolean(resp.querySelector('collection, d\\:collection, D\\:collection'));
      const lengthEl = resp.querySelector('getcontentlength, d\\:getcontentlength, D\\:getcontentlength');
      const size = lengthEl ? parseInt(lengthEl.textContent || '0', 10) : 0;

      const modifiedEl = resp.querySelector('getlastmodified, d\\:getlastmodified, D\\:getlastmodified');
      const lastModified = modifiedEl && modifiedEl.textContent ? new Date(modifiedEl.textContent).getTime() : Date.now();

      const name = relPath.split('/').pop() || relPath;

      results.push({
        path: relPath,
        name,
        size,
        lastModified,
        isDirectory: isDir,
      });
    });

    return results;
  }

  public async readFile(relPath: string): Promise<string> {
    const url = this.getRemoteUrl(relPath);
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Ошибка скачивания файла ${relPath}: HTTP ${res.status}`);
    }

    return await res.text();
  }

  public async writeFile(relPath: string, content: string): Promise<void> {
    // Проверяем и создаем родительские папки
    const parts = relPath.split('/');
    if (parts.length > 1) {
      parts.pop();
      let cur = '';
      for (const p of parts) {
        cur = cur ? `${cur}/${p}` : p;
        await this.createFolder(cur);
      }
    }

    const url = this.getRemoteUrl(relPath);
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders({
        'Content-Type': 'text/plain; charset=utf-8',
      }),
      body: content,
    });

    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(`Ошибка записи файла ${relPath} по WebDAV: HTTP ${res.status}`);
    }
  }

  public async deleteFile(relPath: string): Promise<void> {
    const url = this.getRemoteUrl(relPath);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Ошибка удаления файла ${relPath}: HTTP ${res.status}`);
    }
  }
}
