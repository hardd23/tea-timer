'use client';

import { useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'tea-timer-theme';
const THEME_CHANGE_EVENT = 'tea-timer-theme-change';
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

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
  };

  const nextThemeLabel = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextThemeLabel} theme`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextThemeLabel} theme`}
    >
      <span className="theme-toggle-thumb" aria-hidden="true" />
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
    </button>
  );
}
