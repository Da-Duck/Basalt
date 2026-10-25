import type { Language } from '../i18n/i18n';
import { setLang } from '../i18n/i18n';

export type ThemePreset = 'default' | 'oled' | 'light' | 'custom';

export interface BasaltSettings {
  language: Language;
  themePreset: ThemePreset;
  customBg: string;
  customAccent: string;
  trashRetentionDays: number; // 0 = бессрочно
  activeWorkspace: string;
}

const DEFAULT_SETTINGS: BasaltSettings = {
  language: 'ru',
  themePreset: 'default',
  customBg: '#11141b',
  customAccent: '#e5a93c',
  trashRetentionDays: 7,
  activeWorkspace: '',
};

class SettingsManager {
  private settings: BasaltSettings;

  constructor() {
    this.settings = this.load();
    this.applyTheme();
    setLang(this.settings.language);
  }

  private load(): BasaltSettings {
    try {
      const raw = localStorage.getItem('basalt-settings');
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Ошибка загрузки настроек:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public save(newSettings: Partial<BasaltSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('basalt-settings', JSON.stringify(this.settings));
    } catch (e) {
      console.error('Ошибка сохранения настроек:', e);
    }

    if (newSettings.language) {
      setLang(newSettings.language);
    }

    this.applyTheme();
  }

  public get(): BasaltSettings {
    return { ...this.settings };
  }

  public applyTheme() {
    const root = document.documentElement;
    const body = document.body;

    body.classList.remove('theme-light', 'theme-oled');

    let bgMain = '#11141b';
    let bgSidebar = '#12151d';
    let bgApp = '#090b0e';
    let accent = '#e5a93c';
    let textMain = '#f8fafc';
    let textSecondary = '#94a3b8';
    let borderColor = 'rgba(255, 255, 255, 0.08)';

    switch (this.settings.themePreset) {
      case 'oled':
        body.classList.add('theme-oled');
        bgMain = '#000000';
        bgSidebar = '#050507';
        bgApp = '#000000';
        accent = '#e5a93c';
        borderColor = 'rgba(255, 255, 255, 0.12)';
        break;

      case 'light':
        body.classList.add('theme-light');
        bgMain = '#ffffff';
        bgSidebar = '#f8fafc';
        bgApp = '#f1f5f9';
        accent = '#d97706';
        textMain = '#0f172a';
        textSecondary = '#475569';
        borderColor = 'rgba(0, 0, 0, 0.08)';
        break;

      case 'custom':
        bgMain = this.settings.customBg;
        bgSidebar = this.adjustBrightness(this.settings.customBg, 5);
        bgApp = this.adjustBrightness(this.settings.customBg, -10);
        accent = this.settings.customAccent;
        break;

      case 'default':
      default:
        bgMain = '#11141b';
        bgSidebar = '#12151d';
        bgApp = '#090b0e';
        accent = '#e5a93c';
        break;
    }

    root.style.setProperty('--bg-main', bgMain);
    root.style.setProperty('--bg-sidebar', bgSidebar);
    root.style.setProperty('--bg-app', bgApp);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--text-main', textMain);
    root.style.setProperty('--text-secondary', textSecondary);
    root.style.setProperty('--border-color', borderColor);

    // Вычисляемые цвета для акцента
    root.style.setProperty('--accent-glow', this.hexToRgba(accent, 0.35));
    root.style.setProperty('--accent-subtle', this.hexToRgba(accent, 0.14));
    root.style.setProperty('--accent-border', this.hexToRgba(accent, 0.3));
    root.style.setProperty('--accent-hover', this.adjustBrightness(accent, 15));
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private adjustBrightness(hex: string, percent: number): string {
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    let r = ((num >> 16) & 255) + Math.round((255 * percent) / 100);
    let g = ((num >> 8) & 255) + Math.round((255 * percent) / 100);
    let b = (num & 255) + Math.round((255 * percent) / 100);

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
}

export const settingsManager = new SettingsManager();
