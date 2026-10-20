'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

export type Language = 'ru' | 'en';

const LANGUAGE_STORAGE_KEY = 'tea-timer-language';
const LANGUAGE_CHANGE_EVENT = 'tea-timer-language-change';

const translations = {
  ru: {
    appName: 'Чайный таймер',
    brandLeft: 'Чайный',
    brandRight: 'таймер',
    brewTime: 'Время заваривания',
    teaTimerControls: 'Управление чайным таймером',
    minutes: 'мин.',
    seconds: 'сек.',
    start: 'Старт',
    stop: 'Стоп',
    noActiveTimers: 'Нет активных таймеров',
    remaining: 'осталось',
    overtime: 'остывает',
    made: 'Сделан',
    madePlural: 'Сделано',
    pourOne: 'пролив',
    pourFew: 'пролива',
    pourMany: 'проливов',
    decreasePourCount: 'Уменьшить количество проливов',
    increasePourCount: 'Увеличить количество проливов',
    resetSession: 'Начать новое чаепитие',
    resetTitle: 'Начать новое чаепитие?',
    resetDescription: 'Счётчик проливов будет обнулён, а активный таймер остановлен.',
    cancel: 'Отмена',
    reset: 'Сбросить',
    teaWisdom: 'Чайное высказывание',
    openTeaWisdom: 'Открыть чайное высказывание',
    closeTeaWisdom: 'Закрыть чайное высказывание',
    more: 'Ещё',
    teaCooling: 'Ваш чай остывает...',
    switchToLightTheme: 'Включить светлую тему',
    switchToDarkTheme: 'Включить тёмную тему',
    switchToEnglish: 'Switch to English',
    switchToRussian: 'Переключить на русский',
    supportAuthor: 'Угостить автора чаем',
  },
  en: {
    appName: 'Tea timer',
    brandLeft: 'Tea',
    brandRight: 'timer',
    brewTime: 'Brewing time',
    teaTimerControls: 'Tea timer controls',
    minutes: 'min',
    seconds: 'sec',
    start: 'Start',
    stop: 'Stop',
    noActiveTimers: 'No active timers',
    remaining: 'remaining',
    overtime: 'cooling',
    made: 'Made',
    madePlural: 'Made',
    pourOne: 'brew',
    pourFew: 'brews',
    pourMany: 'brews',
    decreasePourCount: 'Decrease brew count',
    increasePourCount: 'Increase brew count',
    resetSession: 'Start a new tea session',
    resetTitle: 'Start a new tea session?',
    resetDescription: 'The brew counter will reset and the active timer will stop.',
    cancel: 'Cancel',
    reset: 'Reset',
    teaWisdom: 'Tea wisdom',
    openTeaWisdom: 'Open tea wisdom',
    closeTeaWisdom: 'Close tea wisdom',
    more: 'More',
    teaCooling: 'Your tea is cooling...',
    switchToLightTheme: 'Switch to light theme',
    switchToDarkTheme: 'Switch to dark theme',
    switchToEnglish: 'Switch to English',
    switchToRussian: 'Switch to Russian',
    supportAuthor: 'Treat the author to tea',
  },
} as const;

export type TranslationKey = keyof (typeof translations)['ru'];

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const getStoredLanguage = (): Language => {
  try {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return savedLanguage === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
};

const getServerLanguage = (): Language => 'ru';

const subscribeToLanguage = (onLanguageChange: () => void) => {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
  return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
};

const applyLanguage = (language: Language) => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selected language still applies for the current session.
  }

  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeToLanguage,
    getStoredLanguage,
    getServerLanguage,
  );

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The selected language still applies for the current session.
    }
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => applyLanguage(nextLanguage), []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey) => translations[language][key],
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
