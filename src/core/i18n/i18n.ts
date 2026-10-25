export type Language = 'ru' | 'en';

export const translations = {
  ru: {
    vault: 'Хранилище',
    notConnected: 'Не подключено',
    openFolder: 'Открыть папку',
    filesAndFolders: 'Файлы & Папки',
    notesCount: 'заметок',
    notesCountZero: '0 заметок',
    newNote: 'Новая заметка',
    newFolder: 'Новая папка',
    searchPlaceholder: 'Поиск по названию...',
    workspace: 'Пространство',
    allVault: 'Всё хранилище',
    newWorkspace: '+ Новое пространство',
    changeIcon: 'Изменить иконку',
    changeIconOrColor: 'Изменить иконку или цвет',
    chooseIconTitle: 'Выберите иконку',
    chooseIconOrColorTitle: 'Выберите иконку или цвет',
    noteTitleColor: 'Цвет названия заметки',
    resetColor: 'Сбросить цвет',
    defaultColor: 'По умолчанию',
    rename: 'Переименовать',
    renameNote: 'Переименовать заметку',
    renameFolder: 'Переименовать папку',
    promptRenameNote: 'Введите новое название заметки',
    promptRenameFolder: 'Введите новое название папки',
    applySettings: 'Применить настройки',
    tabSvgIcons: 'Векторные значки',
    tabEmojis: 'Эмодзи',
    resetIconDefault: 'Сбросить иконку по умолчанию',
    trash: 'Корзина',
    trashTitle: 'Корзина удалённых заметок',
    trashEmpty: 'Корзина пуста',
    trashRetentionNotice: 'Заметки автоматически удаляются через',
    trashRetentionDays: 'дней',
    created: 'Создано',
    deleted: 'Удалено',
    restore: 'Восстановить',
    deletePermanently: 'Удалить навсегда',
    settings: 'Настройки',
    settingsTitle: 'Настройки Basalt',
    theme: 'Тема оформления',
    themePresetDefault: 'Охра (По умолчанию)',
    themePresetOled: 'Глубокая тёмная (OLED)',
    themePresetLight: 'Светлая',
    themePresetCustom: 'Своя палитра',
    bgColor: 'Цвет фона',
    accentColor: 'Акцентный цвет',
    language: 'Язык интерфейса',
    trashRetentionPeriod: 'Период хранения в корзине (в днях)',
    daysUnit: 'дней (0 = бессрочно)',
    daysPrompt: 'дней',
    infinity: 'Бессрочно',
    saveStatusReady: 'Готово',
    saveStatusSaving: 'Сохранение...',
    saveStatusSaved: 'Сохранено ✓',
    saveStatusError: 'Ошибка',
    wordsCount: 'слов',
    charsCount: 'знаков',
    emptyFolderText: 'В этой папке пока нет файлов',
    emptyVaultText: 'Откройте папку на вашем ПК, чтобы просматривать структуру и редактировать заметки',
    welcomeTitle: 'Добро пожаловать в Basalt',
    confirmPermanentDelete: 'Удалить эту заметку навсегда без возможности восстановления?',
    confirmDeleteFolder: 'Удалить папку "{name}" и всё её содержимое?',
    promptNoteName: 'Введите название заметки',
    promptFolderName: 'Введите название папки',
    promptWorkspaceName: 'Введите название нового пространства (папки)',
    createNoteInFolder: 'Создать файл в этой папке',
    createSubfolder: 'Создать вложенную папку',
    deleteFolder: 'Удалить папку',
    collapseSidebar: 'Скрыть боковую панель',
    expandSidebar: 'Развернуть боковую панель',
    infoTitle: 'Справка по Markdown',
    infoTooltip: 'Справка Markdown',
    nothingFound: 'Ничего не найдено',
    browserNotSupported: 'Браузер не поддерживается',
    browserNotSupportedDesc: 'Требуется браузер с поддержкой File System Access API (Chrome, Edge)',
    welcomeBody: 'Папка пуста. Начните писать здесь свои мысли или нажмите «+», чтобы создать новую заметку.',
    errorOpenVault: 'Не удалось открыть папку',
    errorReadFile: 'Не удалось прочитать файл',
    errorCreateFile: 'Не удалось создать файл',
    errorCreateFolder: 'Не удалось создать папку',
    errorDelete: 'Не удалось удалить',
    errorMove: 'Не удалось переместить',
    welcomeFileName: 'Добро пожаловать.md',
    modeEdit: 'Редактор',
    modeSplit: 'Сплит',
    modePreview: 'Просмотр',
    noteNotFoundPrompt: 'Заметка "{name}" не найдена. Создать новую заметку с таким именем?',
    emptyPreviewText: 'Заметка пуста. Начните писать текст в редакторе слева.',
    clearSearch: 'Очистить поиск',
  },
  en: {
    vault: 'Vault',
    notConnected: 'Not connected',
    openFolder: 'Open Folder',
    filesAndFolders: 'Files & Folders',
    notesCount: 'notes',
    notesCountZero: '0 notes',
    newNote: 'New Note',
    newFolder: 'New Folder',
    searchPlaceholder: 'Search by title...',
    workspace: 'Workspace',
    allVault: 'All Vault',
    newWorkspace: '+ New Workspace',
    changeIcon: 'Change icon',
    changeIconOrColor: 'Change icon or color',
    chooseIconTitle: 'Select an icon',
    chooseIconOrColorTitle: 'Choose icon or color',
    noteTitleColor: 'Note title color',
    resetColor: 'Reset color',
    defaultColor: 'Default',
    rename: 'Rename',
    renameNote: 'Rename note',
    renameFolder: 'Rename folder',
    promptRenameNote: 'Enter new note title',
    promptRenameFolder: 'Enter new folder name',
    applySettings: 'Apply Settings',
    tabSvgIcons: 'Vector Icons',
    tabEmojis: 'Emoji',
    resetIconDefault: 'Reset icon to default',
    trash: 'Trash',
    trashTitle: 'Trash Bin',
    trashEmpty: 'Trash is empty',
    trashRetentionNotice: 'Notes are automatically deleted after',
    trashRetentionDays: 'days',
    created: 'Created',
    deleted: 'Deleted',
    restore: 'Restore',
    deletePermanently: 'Delete permanently',
    settings: 'Settings',
    settingsTitle: 'Basalt Settings',
    theme: 'Appearance Theme',
    themePresetDefault: 'Ochre (Default)',
    themePresetOled: 'Pure Dark (OLED)',
    themePresetLight: 'Light',
    themePresetCustom: 'Custom Theme',
    bgColor: 'Background color',
    accentColor: 'Accent color',
    language: 'Interface Language',
    trashRetentionPeriod: 'Trash Retention Period (in days)',
    daysUnit: 'days (0 = forever)',
    daysPrompt: 'days',
    infinity: 'Forever',
    saveStatusReady: 'Ready',
    saveStatusSaving: 'Saving...',
    saveStatusSaved: 'Saved ✓',
    saveStatusError: 'Error',
    wordsCount: 'words',
    charsCount: 'characters',
    emptyFolderText: 'No files in this folder yet',
    emptyVaultText: 'Open a local folder on your PC to view the file tree and edit notes',
    welcomeTitle: 'Welcome to Basalt',
    confirmPermanentDelete: 'Permanently delete this note without recovery?',
    confirmDeleteFolder: 'Delete folder "{name}" and all its contents?',
    promptNoteName: 'Enter note title',
    promptFolderName: 'Enter folder name',
    promptWorkspaceName: 'Enter new workspace (folder) name',
    createNoteInFolder: 'Create note in this folder',
    createSubfolder: 'Create subfolder',
    deleteFolder: 'Delete folder',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    infoTitle: 'Markdown Reference Guide',
    infoTooltip: 'Markdown Guide',
    nothingFound: 'Nothing found',
    browserNotSupported: 'Browser is not supported',
    browserNotSupportedDesc: 'Requires a browser supporting File System Access API (Chrome, Edge)',
    welcomeBody: 'The folder is empty. Start writing your notes here or click "+" to create a new note.',
    errorOpenVault: 'Failed to open folder',
    errorReadFile: 'Failed to read file',
    errorCreateFile: 'Failed to create file',
    errorCreateFolder: 'Failed to create folder',
    errorDelete: 'Failed to delete',
    errorMove: 'Failed to move',
    welcomeFileName: 'Welcome.md',
    modeEdit: 'Edit',
    modeSplit: 'Split',
    modePreview: 'Preview',
    noteNotFoundPrompt: 'Note "{name}" not found. Create a new note with this name?',
    emptyPreviewText: 'Note is empty. Start writing in the editor on the left.',
    clearSearch: 'Clear search',
  },
};

function getInitialLang(): Language {
  try {
    const direct = localStorage.getItem('basalt-lang') as Language;
    if (direct === 'ru' || direct === 'en') return direct;
    const settingsRaw = localStorage.getItem('basalt-settings');
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed.language === 'ru' || parsed.language === 'en') return parsed.language;
    }
  } catch {
    // fallback
  }
  return 'ru';
}

let currentLang: Language = getInitialLang();

export function getLang(): Language {
  return currentLang;
}

export function setLang(lang: Language) {
  currentLang = lang;
  try {
    localStorage.setItem('basalt-lang', lang);
  } catch {
    // ignore
  }
}

export function t(key: keyof typeof translations['ru'], params?: Record<string, string | number>): string {
  let text = translations[currentLang]?.[key] || translations['ru']?.[key] || (key as string);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} ${many}`;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function formatNotesCount(count: number): string {
  return currentLang === 'en'
    ? `${count} ${count === 1 ? 'note' : 'notes'}`
    : pluralizeRu(count, 'заметка', 'заметки', 'заметок');
}

export function formatWordsCount(count: number): string {
  return currentLang === 'en'
    ? `${count} ${count === 1 ? 'word' : 'words'}`
    : pluralizeRu(count, 'слово', 'слова', 'слов');
}

export function formatCharsCount(count: number): string {
  return currentLang === 'en'
    ? `${count} ${count === 1 ? 'char' : 'chars'}`
    : pluralizeRu(count, 'знак', 'знака', 'знаков');
}

export function formatRetentionDays(days: number): string {
  if (days === 0) return t('infinity');
  return currentLang === 'en'
    ? `${days} ${days === 1 ? 'day' : 'days'}`
    : pluralizeRu(days, 'день', 'дня', 'дней');
}
