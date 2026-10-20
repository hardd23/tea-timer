'use client';

import TeaTimer from './components/TeaTimer';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import LanguageToggle from './components/LanguageToggle';
import SessionResetButton from './components/SessionResetButton';
import { TeaSessionProvider } from './components/TeaSessionContext';
import TeaWisdom from './components/TeaWisdom';
import ThemeToggle from './components/ThemeToggle';

function TeaTimerApp() {
  const { language, t } = useLanguage();

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="page-frame mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-4 sm:px-6">
        <TeaSessionProvider>
          <header className="brand-header" aria-label={t('appName')}>
            <h1 className={`brand-lockup is-${language}`}>
              <span>{t('brandLeft')}</span>
              <span className="brand-kanji" aria-hidden="true">茶</span>
              <span>{t('brandRight')}</span>
            </h1>
            <div className="header-action-stack header-action-stack-left">
              <TeaWisdom />
              <SessionResetButton />
            </div>
            <div className="header-action-stack header-action-stack-right">
              <ThemeToggle />
              <LanguageToggle />
            </div>
          </header>

          <TeaTimer />

          <footer id="footer" className="app-footer">
            <a
              href="https://t.me/hardd23"
              target="_blank"
              rel="noopener noreferrer"
              className="header-action footer-social-button footer-telegram"
              aria-label="Telegram"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.7 3.5a1.5 1.5 0 0 0-1.6-.2L2.6 10.1a1.5 1.5 0 0 0 .1 2.8l4.4 1.5 1.7 5.1a1.5 1.5 0 0 0 2.5.6l2.5-2.5 4.8 3.5a1.5 1.5 0 0 0 2.4-.9l2.2-15.2a1.5 1.5 0 0 0-1.5-1.3Zm-11 11.2-.4 3.4-1.1-3.4-3.3-1.1L18 6.8l-7.3 7.9Z" />
              </svg>
            </a>
            <a
              href="https://web.tribute.tg/d/OyG"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-support"
              aria-label={t('supportAuthor')}
            >
              {t('supportAuthor')}
            </a>
            <a
              href="https://github.com/hardd23/tea-timer"
              target="_blank"
              rel="noopener noreferrer"
              className="header-action footer-social-button footer-github"
              aria-label="GitHub"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.6.4-1.1.7-1.3-2.2-.2-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.8 9.8 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.8-4.6 5 .4.3.7 1 .7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
              </svg>
            </a>
          </footer>
        </TeaSessionProvider>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <TeaTimerApp />
    </LanguageProvider>
  );
}
