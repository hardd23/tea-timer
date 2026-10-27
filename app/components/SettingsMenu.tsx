'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { APP_VERSION, GITHUB_URL } from '../app-info';
import {
  checkForAppUpdate,
  isUpdateCheckAvailable,
} from '../lib/app-update';
import AppDialog from './AppDialog';
import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';
import { useTheme } from './ThemeToggle';

type UpdateCheckState =
  | { status: 'idle' | 'checking' | 'current' | 'error' }
  | { status: 'available'; version: string; releaseUrl: string };

const subscribeToPlatform = () => () => {};
const getUpdateCheckSnapshot = () => isUpdateCheckAvailable();
const getServerUpdateCheckSnapshot = () => false;

export default function SettingsMenu() {
  const { language, setLanguage, t } = useLanguage();
  const { adjustPourCount, pourCount, requestSessionReset } = useTeaSession();
  const { theme, setTheme } = useTheme();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isCheckingUpdatesRef = useRef(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateCheckState>({ status: 'idle' });
  const canCheckForUpdates = useSyncExternalStore(
    subscribeToPlatform,
    getUpdateCheckSnapshot,
    getServerUpdateCheckSnapshot,
  );

  const openAbout = () => {
    setIsMenuOpen(false);
    setIsAboutOpen(true);
  };

  const openResetConfirmation = () => {
    setIsMenuOpen(false);
    window.setTimeout(requestSessionReset, 0);
  };

  const checkForUpdates = async () => {
    if (isCheckingUpdatesRef.current) return;

    isCheckingUpdatesRef.current = true;
    setIsMenuOpen(false);
    setIsUpdateOpen(true);
    setUpdateState({ status: 'checking' });

    try {
      const result = await checkForAppUpdate();
      setUpdateState(result.updateAvailable
        ? {
            status: 'available',
            version: result.latestVersion,
            releaseUrl: result.releaseUrl,
          }
        : { status: 'current' });
    } catch {
      setUpdateState({ status: 'error' });
    } finally {
      isCheckingUpdatesRef.current = false;
    }
  };

  const updateMessage = updateState.status === 'checking'
    ? t('checkingForUpdates')
    : updateState.status === 'current'
      ? t('latestVersionInstalled')
      : updateState.status === 'available'
        ? `${t('updateAvailable')} ${updateState.version}`
        : updateState.status === 'error'
          ? t('updateCheckFailed')
          : '';

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

          {canCheckForUpdates ? (
            <button
              type="button"
              className="settings-menu-link"
              onClick={() => void checkForUpdates()}
              disabled={updateState.status === 'checking'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M20 11a8 8 0 0 0-14.8-4M4 4v5h5M4 13a8 8 0 0 0 14.8 4M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('checkForUpdates')}
            </button>
          ) : null}

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
        id="update-check-dialog"
        isOpen={isUpdateOpen}
        labelledBy="update-check-title"
        closeLabel={t('closeUpdateCheck')}
        contentClassName="update-dialog-panel"
        onRequestClose={() => setIsUpdateOpen(false)}
        returnFocusRef={triggerRef}
      >
        <div className="update-dialog-content">
          <svg
            className={updateState.status === 'checking' ? 'update-dialog-icon is-checking' : 'update-dialog-icon'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M20 11a8 8 0 0 0-14.8-4M4 4v5h5M4 13a8 8 0 0 0 14.8 4M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 id="update-check-title">{t('updateCheckTitle')}</h2>
          <p role="status" aria-live="polite">{updateMessage}</p>
          {updateState.status === 'available' ? (
            <a
              className="update-dialog-download"
              href={updateState.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('downloadUpdate')}
            </a>
          ) : null}
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
