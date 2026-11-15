const { app, BrowserWindow, dialog, ipcMain, session, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');

let mainWindow = null;

// Блокировка повторного запуска второго экземпляра
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Путь к файлу истории хранилищ
function getVaultHistoryFile() {
  return path.join(app.getPath('userData'), 'basalt-vault-history.json');
}

function loadLastVaultPath() {
  try {
    const file = getVaultHistoryFile();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.lastVault && fs.existsSync(data.lastVault)) {
        return data.lastVault;
      }
    }
  } catch (err) {
    console.warn('Не удалось загрузить последнее хранилище:', err);
  }
  return null;
}

function saveLastVaultPath(vaultPath) {
  try {
    const file = getVaultHistoryFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ lastVault: vaultPath }, null, 2), 'utf8');
  } catch (err) {
    console.warn('Не удалось сохранить путь последнего хранилища:', err);
  }
}

// Безопасное разрешение путей внутри выбранного хранилища
function resolveVaultPath(vaultPath, relPath = '') {
  const normalizedRel = (relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const full = path.resolve(vaultPath, normalizedRel);
  // Защита от выхода за пределы хранилища
  if (!full.startsWith(path.resolve(vaultPath))) {
    throw new Error('Попытка доступа за пределы корневого каталога хранилища.');
  }
  return full;
}

// Рекурсивное сканирование папки
async function scanDir(vaultPath, currentRel = '') {
  const currentAbs = resolveVaultPath(vaultPath, currentRel);
  const dirents = await fsPromises.readdir(currentAbs, { withFileTypes: true });
  const entries = [];

  for (const dirent of dirents) {
    const name = dirent.name;

    // Игнорируем скрытые и служебные каталоги
    if (name.startsWith('.') || name === 'node_modules') continue;

    const childRel = currentRel ? `${currentRel}/${name}` : name;
    const childAbs = path.join(currentAbs, name);

    if (dirent.isDirectory()) {
      entries.push({
        name,
        path: childRel,
        isDirectory: true,
      });
      const subEntries = await scanDir(vaultPath, childRel);
      entries.push(...subEntries);
    } else if (dirent.isFile()) {
      if (name.endsWith('.md') || name.endsWith('.txt')) {
        const stat = await fsPromises.stat(childAbs);
        entries.push({
          name,
          path: childRel,
          isDirectory: false,
          size: stat.size,
          lastModified: stat.mtimeMs,
        });
      }
    }
  }

  return entries;
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  const iconPath = path.join(__dirname, '../build/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 840,
    minHeight: 580,
    title: 'Basalt',
    backgroundColor: '#11141b',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  // Открытие внешних ссылок (http / https) в системном браузере пользователя по умолчанию
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Регистрация обработчиков IPC
function registerIpcHandlers() {
  // Диалог выбора папки хранилища
  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите папку хранилища заметок',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    saveLastVaultPath(selectedPath);
    return {
      path: selectedPath,
      name: path.basename(selectedPath),
    };
  });

  // Получить путь последнего открытого хранилища
  ipcMain.handle('vault:getLast', async () => {
    const last = loadLastVaultPath();
    if (!last) return null;
    return {
      path: last,
      name: path.basename(last),
    };
  });

  // Сохранить текущее хранилище как последнее
  ipcMain.handle('vault:setLast', async (_e, vaultPath) => {
    if (vaultPath) {
      saveLastVaultPath(vaultPath);
    }
    return true;
  });

  // Сканирование директории
  ipcMain.handle('fs:scanDirectory', async (_e, vaultPath) => {
    try {
      if (!fs.existsSync(vaultPath)) return [];
      return await scanDir(vaultPath, '');
    } catch (err) {
      console.error('Ошибка сканирования хранилища:', err);
      throw err;
    }
  });

  // Чтение файла
  ipcMain.handle('fs:readFile', async (_e, vaultPath, relPath) => {
    const full = resolveVaultPath(vaultPath, relPath);
    return await fsPromises.readFile(full, 'utf8');
  });

  // Запись файла
  ipcMain.handle('fs:writeFile', async (_e, vaultPath, relPath, content) => {
    const full = resolveVaultPath(vaultPath, relPath);
    await fsPromises.writeFile(full, content, 'utf8');
    return true;
  });

  // Гарантированная запись (с созданием каталогов)
  ipcMain.handle('fs:ensureFile', async (_e, vaultPath, relPath, content) => {
    const full = resolveVaultPath(vaultPath, relPath);
    await fsPromises.mkdir(path.dirname(full), { recursive: true });
    await fsPromises.writeFile(full, content, 'utf8');
    return true;
  });

  // Создание файла
  ipcMain.handle('fs:createFile', async (_e, vaultPath, relPath, content = '') => {
    const full = resolveVaultPath(vaultPath, relPath);
    await fsPromises.mkdir(path.dirname(full), { recursive: true });
    await fsPromises.writeFile(full, content, 'utf8');
    const stat = await fsPromises.stat(full);
    return {
      name: path.basename(relPath),
      path: relPath.replace(/\\/g, '/'),
      isDirectory: false,
      size: stat.size,
      lastModified: stat.mtimeMs,
    };
  });

  // Создание папки
  ipcMain.handle('fs:createFolder', async (_e, vaultPath, relPath) => {
    const full = resolveVaultPath(vaultPath, relPath);
    await fsPromises.mkdir(full, { recursive: true });
    return {
      name: path.basename(relPath),
      path: relPath.replace(/\\/g, '/'),
      isDirectory: true,
    };
  });

  // Удаление файла
  ipcMain.handle('fs:deleteFile', async (_e, vaultPath, relPath) => {
    const full = resolveVaultPath(vaultPath, relPath);
    if (fs.existsSync(full)) {
      await fsPromises.unlink(full);
    }
    return true;
  });

  // Удаление папки
  ipcMain.handle('fs:deleteFolder', async (_e, vaultPath, relPath) => {
    const full = resolveVaultPath(vaultPath, relPath);
    if (fs.existsSync(full)) {
      await fsPromises.rm(full, { recursive: true, force: true });
    }
    return true;
  });

  // Переименование файла
  ipcMain.handle('fs:renameFile', async (_e, vaultPath, oldRelPath, newName) => {
    const oldFull = resolveVaultPath(vaultPath, oldRelPath);
    const parentDir = path.dirname(oldFull);
    const newFull = path.join(parentDir, newName);

    await fsPromises.rename(oldFull, newFull);
    const stat = await fsPromises.stat(newFull);

    const relParent = path.dirname(oldRelPath).replace(/\\/g, '/');
    const newRelPath = relParent === '.' ? newName : `${relParent}/${newName}`;

    return {
      name: newName,
      path: newRelPath,
      isDirectory: false,
      size: stat.size,
      lastModified: stat.mtimeMs,
    };
  });

  // Переименование папки
  ipcMain.handle('fs:renameFolder', async (_e, vaultPath, oldRelPath, newName) => {
    const oldFull = resolveVaultPath(vaultPath, oldRelPath);
    const parentDir = path.dirname(oldFull);
    const newFull = path.join(parentDir, newName);

    await fsPromises.rename(oldFull, newFull);

    const relParent = path.dirname(oldRelPath).replace(/\\/g, '/');
    const newRelPath = relParent === '.' ? newName : `${relParent}/${newName}`;

    return {
      name: newName,
      path: newRelPath,
      isDirectory: true,
    };
  });

  // Перемещение файла или папки
  ipcMain.handle('fs:moveEntry', async (_e, vaultPath, oldRelPath, newParentRelPath) => {
    const oldFull = resolveVaultPath(vaultPath, oldRelPath);
    const targetParentFull = resolveVaultPath(vaultPath, newParentRelPath);
    const entryName = path.basename(oldFull);
    const newFull = path.join(targetParentFull, entryName);

    await fsPromises.mkdir(targetParentFull, { recursive: true });
    await fsPromises.rename(oldFull, newFull);

    const stat = await fsPromises.stat(newFull);
    const isDir = stat.isDirectory();
    const cleanParent = (newParentRelPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const newRelPath = cleanParent ? `${cleanParent}/${entryName}` : entryName;

    return {
      name: entryName,
      path: newRelPath,
      isDirectory: isDir,
      size: stat.size,
      lastModified: stat.mtimeMs,
    };
  });

  // Метаданные: чтение .basalt/metadata.json
  ipcMain.handle('fs:readVaultMetadata', async (_e, vaultPath) => {
    const metaPath = path.join(vaultPath, '.basalt', 'metadata.json');
    if (fs.existsSync(metaPath)) {
      return await fsPromises.readFile(metaPath, 'utf8');
    }
    return null;
  });

  // Метаданные: запись .basalt/metadata.json
  ipcMain.handle('fs:writeVaultMetadata', async (_e, vaultPath, content) => {
    const dir = path.join(vaultPath, '.basalt');
    await fsPromises.mkdir(dir, { recursive: true });
    await fsPromises.writeFile(path.join(dir, 'metadata.json'), content, 'utf8');
    return true;
  });
}

app.whenReady().then(() => {
  // Разрешаем доступ к каталогам без предупреждений Chromium
  session.defaultSession.on('file-system-access-restricted', (_e, _details, callback) => {
    callback('allow');
  });

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
