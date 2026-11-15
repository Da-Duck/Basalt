const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('basaltDesktop', {
  isDesktop: true,

  // Хранилище (диалог выбора и запоминание пути)
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  getLastVault: () => ipcRenderer.invoke('vault:getLast'),
  setLastVault: (vaultPath) => ipcRenderer.invoke('vault:setLast', vaultPath),

  // Файловые операции
  scanDirectory: (vaultPath) => ipcRenderer.invoke('fs:scanDirectory', vaultPath),
  readFile: (vaultPath, relPath) => ipcRenderer.invoke('fs:readFile', vaultPath, relPath),
  writeFile: (vaultPath, relPath, content) => ipcRenderer.invoke('fs:writeFile', vaultPath, relPath, content),
  ensureFile: (vaultPath, relPath, content) => ipcRenderer.invoke('fs:ensureFile', vaultPath, relPath, content),
  createFile: (vaultPath, relPath, content) => ipcRenderer.invoke('fs:createFile', vaultPath, relPath, content),
  createFolder: (vaultPath, relPath) => ipcRenderer.invoke('fs:createFolder', vaultPath, relPath),
  deleteFile: (vaultPath, relPath) => ipcRenderer.invoke('fs:deleteFile', vaultPath, relPath),
  deleteFolder: (vaultPath, relPath) => ipcRenderer.invoke('fs:deleteFolder', vaultPath, relPath),
  renameFile: (vaultPath, oldRelPath, newName) => ipcRenderer.invoke('fs:renameFile', vaultPath, oldRelPath, newName),
  renameFolder: (vaultPath, oldRelPath, newName) => ipcRenderer.invoke('fs:renameFolder', vaultPath, oldRelPath, newName),
  moveEntry: (vaultPath, oldRelPath, newParentRelPath) => ipcRenderer.invoke('fs:moveEntry', vaultPath, oldRelPath, newParentRelPath),

  // Метаданные (.basalt/metadata.json)
  readVaultMetadata: (vaultPath) => ipcRenderer.invoke('fs:readVaultMetadata', vaultPath),
  writeVaultMetadata: (vaultPath, content) => ipcRenderer.invoke('fs:writeVaultMetadata', vaultPath, content),
});
