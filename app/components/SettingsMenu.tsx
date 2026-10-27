'use client';

import { useRef, useState } from 'react';
import { APP_VERSION, GITHUB_URL } from '../app-info';
import AppDialog from './AppDialog';
import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';
import { useTheme } from './ThemeToggle';

export default function SettingsMenu() {
  const { language, setLanguage, t } = useLanguage();
  const { adjustPourCount, pourCount, requestSessionReset } = useTeaSession();
  const { theme, setTheme } = useTheme();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const openAbout = () => {
    setIsMenuOpen(false);
    setIsAboutOpen(true);
  };

  const openResetConfirmation = () => {
    setIsMenuOpen(false);
    window.setTimeout(requestSessionReset, 0);
  };

  return (
    <>
      <button
        id="settings-menu-button"
        ref={triggerRef}
        type="button"
        className="header-action settings-menu-trigger"
        onClick={() => setIsMenuOpen(true)}
        aria-label={t('openSettings')}
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        aria-controls="settings-menu-dialog"
        title={t('settingsTitle')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <AppDialog
        id="settings-menu-dialog"
        isOpen={isMenuOpen}
        labelledBy="settings-menu-title"
        closeLabel={t('closeSettings')}
        contentClassName="settings-menu-panel"
        onRequestClose={() => setIsMenuOpen(false)}
        returnFocusRef={triggerRef}
      >
        <div className="settings-menu-content">
          <h2 id="settings-menu-title">{t('settingsTitle')}</h2>

          <div className="settings-menu-row">
            <span>{t('themeSetting')}</span>
            <div className="settings-segmented-control" role="group" aria-label={t('themeSetting')}>
              <button type="button" onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
                {t('lightTheme')}
              </button>
              <button type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
                {t('darkTheme')}
              </button>
            </div>
          </div>

          <div className="settings-menu-row">
            <span>{t('languageSetting')}</span>
            <div className="settings-segmented-control" role="group" aria-label={t('languageSetting')}>
              <button type="button" onClick={() => setLanguage('ru')} aria-pressed={language === 'ru'}>
                RU
              </button>
              <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>
                EN
              </button>
            </div>
          </div>

          <div className="settings-menu-row settings-pour-row">
            <span>{t('pourCountSetting')}</span>
            <div className="settings-pour-control">
              <button type="button" onClick={() => adjustPourCount(-1)} aria-label={t('decreasePourCount')} disabled={pourCount === 0}>−</button>
              <output aria-live="polite">{pourCount}</output>
              <button type="button" onClick={() => adjustPourCount(1)} aria-label={t('increasePourCount')} disabled={pourCount === 99}>+</button>
            </div>
          </div>

          <div className="settings-menu-separator" />

          <button type="button" className="settings-menu-link" onClick={openAbout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 10.5V17M12 7.2v.1" strokeLinecap="round" />
            </svg>
            {t('aboutTeaTimer')}
          </button>

          <div className="settings-menu-separator" />

          <button
            id="session-reset-button"
            type="button"
            className="settings-menu-link settings-menu-reset"
            onClick={openResetConfirmation}
          >
            {t('resetTeaSession')}
          </button>
        </div>
      </AppDialog>

      <AppDialog
        id="about-tea-timer-dialog"
        isOpen={isAboutOpen}
        labelledBy="about-tea-timer-title"
        closeLabel={t('closeAboutTeaTimer')}
        contentClassName="about-dialog-panel"
        onRequestClose={() => setIsAboutOpen(false)}
        returnFocusRef={triggerRef}
      >
        <div className="about-dialog-content">
          <p className="about-dialog-mark" aria-hidden="true">茶</p>
          <h2 id="about-tea-timer-title">Tea Timer</h2>
          <p>{t('aboutDescription')}</p>
          <dl>
            <div><dt>{t('versionLabel')}</dt><dd>{APP_VERSION}</dd></div>
            <div><dt>{t('developerLabel')}</dt><dd>HARDD lab</dd></div>
          </dl>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </AppDialog>
    </>
  );
}
