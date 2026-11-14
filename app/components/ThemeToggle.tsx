'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useLanguage } from './LanguageContext';

export type Theme = 'light' | 'dark';
export type ColorTheme = 'leaf' | 'amber' | 'plum';

const THEME_STORAGE_KEY = 'tea-timer-theme';
const THEME_CHANGE_EVENT = 'tea-timer-theme-change';
const COLOR_THEME_STORAGE_KEY = 'tea-timer-color-theme';
const COLOR_THEME_CHANGE_EVENT = 'tea-timer-color-theme-change';
const THEME_COLORS: Record<Theme, string> = {
  light: '#f4f1e8',
  dark: '#111211',
};

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme]);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The visual preference still applies when storage is unavailable.
  }

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
};

const subscribeToTheme = (onThemeChange: () => void) => {
  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
};

const getThemeSnapshot = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

const getServerThemeSnapshot = (): Theme => 'light';

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const setTheme = useCallback((nextTheme: Theme) => applyTheme(nextTheme), []);

  return { theme, setTheme };
}

const getColorThemeSnapshot = (): ColorTheme => {
  const value = document.documentElement.dataset.colorTheme;
  return value === 'amber' || value === 'plum' ? value : 'leaf';
};

const subscribeToColorTheme = (onChange: () => void) => {
  window.addEventListener(COLOR_THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(COLOR_THEME_CHANGE_EVENT, onChange);
};

export function useColorTheme() {
  const colorTheme = useSyncExternalStore(subscribeToColorTheme, getColorThemeSnapshot, () => 'leaf');
  const setColorTheme = useCallback((nextTheme: ColorTheme) => {
    document.documentElement.dataset.colorTheme = nextTheme;
    try {
      window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The selected theme still applies for this session.
    }
    window.dispatchEvent(new Event(COLOR_THEME_CHANGE_EVENT));
  }, []);
  return { colorTheme, setColorTheme };
}

export default function ThemeToggle() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  const nextThemeLabel = theme === 'light'
    ? t('switchToDarkTheme')
    : t('switchToLightTheme');

  return (
    <button
      type="button"
      className="header-action theme-toggle"
      onClick={toggleTheme}
      aria-label={nextThemeLabel}
      aria-pressed={theme === 'dark'}
      title={nextThemeLabel}
    >
      {theme === 'light' ? (
        <svg
          className="theme-toggle-icon theme-toggle-icon-moon"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M16.4 12.5A6.8 6.8 0 0 1 7.5 3.6a6.8 6.8 0 1 0 8.9 8.9Z" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg
          className="theme-toggle-icon theme-toggle-icon-sun"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="3.1" />
          <path d="M10 1.8v1.6M10 16.6v1.6M1.8 10h1.6M16.6 10h1.6M4.2 4.2l1.1 1.1M14.7 14.7l1.1 1.1M15.8 4.2l-1.1 1.1M5.3 14.7l-1.1 1.1" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
