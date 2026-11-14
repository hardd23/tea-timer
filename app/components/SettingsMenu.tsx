'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { App } from '@capacitor/app';
import { APP_VERSION, GITHUB_URL } from '../app-info';
import {
  checkForAppUpdate,
  createUpdateChecker,
  getUpdateInstaller,
  isAndroidApp,
  isUpdateCheckAvailable,
  type AppUpdateResult,
  type InstallStatus,
} from '../lib/app-update';
import AppDialog from './AppDialog';
import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';
import { useColorTheme, useTheme } from './ThemeToggle';

type UpdateCheckState =
  | 'idle' | 'checking' | 'current' | 'error' | 'available' | 'downloading' | 'permission' | 'installing' | 'confirmationRequired' | 'installed' | 'installError';

const subscribeToPlatform = () => () => {};
const getUpdateCheckSnapshot = () => isUpdateCheckAvailable();
const getServerUpdateCheckSnapshot = () => false;

export default function SettingsMenu() {
  const { language, setLanguage, t } = useLanguage();
  const { adjustPourCount, pourCount, requestSessionReset, secondsStep, setSecondsStep } = useTeaSession();
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const checkerRef = useRef(createUpdateChecker(checkForAppUpdate));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateCheckState>('idle');
  const [updateResult, setUpdateResult] = useState<AppUpdateResult | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const canCheckForUpdates = useSyncExternalStore(
    subscribeToPlatform,
    getUpdateCheckSnapshot,
    getServerUpdateCheckSnapshot,
  );

  useEffect(() => {
    if (!isAndroidApp()) return;
    let active = true;
    const backgroundCheck = async () => {
      try {
        const result = await checkerRef.current();
        if (active && result) {
          setUpdateResult(result);
          setUpdateAvailable(result.updateAvailable);
        }
      } catch {
        // Keep the last confirmed notification; a manual check can retry.
      }
    };
    void backgroundCheck();
    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void backgroundCheck();
    });
    return () => { active = false; void listener.then((handle) => handle.remove()).catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!isAndroidApp()) return;
    let active = true;
    const installer = getUpdateInstaller();
    const onStatus = ({ status }: { status: InstallStatus }) => {
      if (!active || status === 'idle') return;
      setUpdateState(status === 'success' ? 'installed' : status === 'failed' ? 'installError' : status);
      if (status === 'success') setUpdateAvailable(false);
    };
    const listener = installer.addListener('installStatus', onStatus);
    void installer.getStatus().then(onStatus).catch(() => {});
    return () => { active = false; void listener.then((handle) => handle.remove()).catch(() => {}); };
  }, []);

  const openAbout = () => {
    setIsMenuOpen(false);
    setIsAboutOpen(true);
  };

  const openResetConfirmation = () => {
    setIsMenuOpen(false);
    window.setTimeout(requestSessionReset, 0);
  };

  const checkForUpdates = async () => {
    setIsMenuOpen(false);
    setIsUpdateOpen(true);
    if (['downloading', 'installing', 'confirmationRequired', 'permission'].includes(updateState)) return;
    setUpdateState('checking');

    try {
      const result = await checkerRef.current(true);
      if (!result) return;
      setUpdateResult(result);
      setUpdateAvailable(result.updateAvailable);
      setUpdateState(result.updateAvailable ? 'available' : 'current');
    } catch {
      setUpdateState('error');
    }
  };

  const downloadUpdate = async () => {
    if (!updateResult?.apk || !isAndroidApp()) return;
    setUpdateState('downloading');
    try {
      await getUpdateInstaller().download(updateResult.apk);
      await installUpdate();
    }
    catch { setUpdateState('error'); }
  };

  const installUpdate = async (requestPermission = false) => {
    if (!isAndroidApp()) return;
    setUpdateState('installing');
    try {
      const installer = getUpdateInstaller();
      const result = await (requestPermission ? installer.requestPermission() : installer.install());
      if (result.status === 'permissionRequired') setUpdateState('permission');
      else {
        const current = await installer.getStatus();
        setUpdateState(current.status === 'success' ? 'installed' : current.status === 'failed' ? 'installError' : current.status === 'confirmationRequired' ? 'confirmationRequired' : 'installing');
      }
    } catch { setUpdateState('installError'); }
  };

  const continueInstall = async () => {
    try {
      const installer = getUpdateInstaller();
      const result = await installer.continueInstall();
      if (result.status === 'installing') {
        const current = await installer.getStatus();
        setUpdateState(current.status === 'success' ? 'installed' : current.status === 'failed' ? 'installError' : current.status === 'confirmationRequired' ? 'confirmationRequired' : 'installing');
      }
    }
    catch { setUpdateState('installError'); }
  };

  const updateMessage = updateState === 'checking'
    ? t('checkingForUpdates')
    : updateState === 'current'
      ? t('latestVersionInstalled')
      : updateState === 'available'
        ? t('updateAvailable')
        : updateState === 'error'
          ? t('updateCheckFailed')
          : updateState === 'downloading' ? t('updateDownloading')
            : updateState === 'permission' ? t('updatePermission')
              : updateState === 'installing' ? t('updateInstalling')
                : updateState === 'confirmationRequired' ? t('updateInstallerOpened')
                  : updateState === 'installed' ? t('updateInstalled')
                    : updateState === 'installError' ? t('updateInstallFailed') : '';

  return (
    <>
      <button
        id="settings-menu-button"
        ref={triggerRef}
        type="button"
        className="header-action settings-menu-trigger"
        onClick={() => setIsMenuOpen(true)}
        aria-label={updateAvailable ? `${t('openSettings')} — ${t('updateNotification')}` : t('openSettings')}
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        aria-controls="settings-menu-dialog"
        title={t('settingsTitle')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
        {updateAvailable ? <span className="update-badge update-badge-trigger" aria-hidden="true" /> : null}
      </button>

      <AppDialog
        id="settings-menu-dialog"
        isOpen={isMenuOpen}
        labelledBy="settings-menu-title"
        closeLabel={t('closeSettings')}
        contentClassName="settings-menu-panel"
        fullScreen
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
            <span>{t('colorThemeSetting')}</span>
            <div className="settings-color-themes" role="group" aria-label={t('colorThemeSetting')}>
              {(['leaf', 'amber', 'plum'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`settings-color-choice settings-color-choice-${option}`}
                  onClick={() => setColorTheme(option)}
                  aria-pressed={colorTheme === option}
                  aria-label={t(option === 'leaf' ? 'colorThemeLeaf' : option === 'amber' ? 'colorThemeAmber' : 'colorThemePlum')}
                  title={t(option === 'leaf' ? 'colorThemeLeaf' : option === 'amber' ? 'colorThemeAmber' : 'colorThemePlum')}
                >
                  <span className="settings-color-swatch" aria-hidden="true">{colorTheme === option ? '✓' : ''}</span>
                </button>
              ))}
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

          <div className="settings-menu-row">
            <span>{t('secondsStepSetting')}</span>
            <div className="settings-segmented-control" role="group" aria-label={t('secondsStepSetting')}>
              <button type="button" onClick={() => setSecondsStep(5)} aria-pressed={secondsStep === 5}>5 {t('seconds')}</button>
              <button type="button" onClick={() => setSecondsStep(10)} aria-pressed={secondsStep === 10}>10 {t('seconds')}</button>
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
              aria-label={updateAvailable ? `${t('checkForUpdates')} — ${t('updateNotification')}` : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M20 11a8 8 0 0 0-14.8-4M4 4v5h5M4 13a8 8 0 0 0 14.8 4M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('checkForUpdates')}
              {updateAvailable ? <span className="update-badge" aria-hidden="true" /> : null}
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
            className={updateState === 'checking' || updateState === 'downloading' || updateState === 'installing' ? 'update-dialog-icon is-checking' : 'update-dialog-icon'}
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
          {updateResult && updateState !== 'checking' ? <p>{t('installedVersion')}: {updateResult.currentVersion}<br />{t('availableVersion')}: {updateResult.latestVersion}</p> : null}
          {updateState === 'available' && isAndroidApp() && updateResult?.apk ? <button type="button" className="update-dialog-download" onClick={() => void downloadUpdate()}>{t('updateApp')}</button> : null}
          {updateState === 'confirmationRequired' ? <button type="button" className="update-dialog-download" onClick={() => void continueInstall()}>{t('continueInstallation')}</button> : null}
          {updateState === 'permission' ? <button type="button" className="update-dialog-download" onClick={() => void installUpdate(true)}>{t('allowInstall')}</button> : null}
          {updateState === 'error' || updateState === 'installError' ? <button type="button" className="update-dialog-download" onClick={() => void checkForUpdates()}>{t('retryUpdate')}</button> : null}
          {updateResult?.updateAvailable && (updateState === 'available' || updateState === 'error' || updateState === 'installError') ? (
            <>
              {!updateResult.apk || !isAndroidApp() ? <p>{t('updateApkUnavailable')}</p> : null}
              <a href={updateResult.releaseUrl} target="_blank" rel="noopener noreferrer">{t('openReleasePage')}</a>
            </>
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
