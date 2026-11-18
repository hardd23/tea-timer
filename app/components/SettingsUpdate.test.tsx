// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from './LanguageContext';
import { TeaSessionProvider } from './TeaSessionContext';
import SettingsMenu from './SettingsMenu';

const mocks = vi.hoisted(() => ({
  check: vi.fn(), listener: vi.fn(),
  installer: { download: vi.fn(), install: vi.fn(), requestPermission: vi.fn(), getStatus: vi.fn(), continueInstall: vi.fn(), addListener: vi.fn() },
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.listener } }));
vi.mock('../lib/app-update', () => ({
  UPDATE_RETRY_INTERVAL_MS: 60_000,
  checkForAppUpdate: vi.fn(),
  createUpdateChecker: () => mocks.check,
  isAndroidApp: () => true,
  isUpdateCheckAvailable: () => true,
  getUpdateInstaller: () => mocks.installer,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.resetAllMocks();
});

it('keeps the notification through a failed manual check and clears it after a successful retry', async () => {
  window.localStorage.setItem('tea-timer-language', 'en');
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  mocks.listener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.addListener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.getStatus.mockResolvedValue({ status: 'idle' });
  const result = { currentVersion: '1.0.0', latestVersion: '2.0.0', releaseUrl: 'https://github.com/hardd23/tea-timer/releases/tag/v2.0.0', updateAvailable: true };
  mocks.check.mockResolvedValueOnce(result).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...result, updateAvailable: false });
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /></TeaSessionProvider></LanguageProvider>);
  const menu = await screen.findByRole('button', { name: 'Open settings — Update available' });
  expect(menu.querySelector('.update-badge')).toBeTruthy();
  fireEvent.click(menu);
  const action = screen.getByRole('button', { name: 'Check for updates — Update available' });
  expect(action.querySelector('.update-badge')).toBeTruthy();
  fireEvent.click(action);
  await screen.findByText('Could not check for updates. Please try again later');
  expect(menu.getAttribute('aria-label')).toContain('Update available');
  fireEvent.click(screen.getByRole('button', { name: 'Retry check' }));
  await screen.findByText('You have the latest version of Tea Timer installed');
  await waitFor(() => expect(menu.getAttribute('aria-label')).toBe('Open settings'));
});

it.each(['success', 'confirmationRequired'] as const)('starts installation after download and handles %s', async (status) => {
  window.localStorage.setItem('tea-timer-language', 'en');
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  mocks.listener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.addListener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.getStatus.mockResolvedValueOnce({ status: 'idle' }).mockResolvedValueOnce({ status });
  mocks.installer.download.mockResolvedValue(undefined);
  mocks.installer.install.mockResolvedValue({ status: 'installing' });
  const result = {
    currentVersion: '1.0.0', latestVersion: '2.0.0', releaseUrl: 'https://github.com/hardd23/tea-timer/releases/tag/v2.0.0', updateAvailable: true,
    apk: { url: 'https://github.com/hardd23/tea-timer/releases/download/v2.0.0/Tea-Timer-2.0.0.apk', sha256: 'a'.repeat(64), size: 100 },
  };
  mocks.check.mockResolvedValue(result);
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Open settings — Update available' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates — Update available' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Update app' }));
  await waitFor(() => expect(mocks.installer.install).toHaveBeenCalledTimes(1));
  expect(mocks.installer.download).toHaveBeenCalledWith(result.apk);
  if (status === 'success') await screen.findByText('The update has been installed.');
  else expect(await screen.findByRole('button', { name: 'Continue installation' })).toBeTruthy();
});

it('explains unknown-source permission and continues after the user allows it', async () => {
  window.localStorage.setItem('tea-timer-language', 'en');
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  mocks.listener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.addListener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.getStatus.mockResolvedValue({ status: 'idle' });
  mocks.installer.download.mockResolvedValue(undefined);
  mocks.installer.install.mockResolvedValue({ status: 'permissionRequired' });
  mocks.installer.requestPermission.mockResolvedValue({ status: 'installing' });
  mocks.check.mockResolvedValue({ currentVersion: '1.0.0', latestVersion: '2.0.0', releaseUrl: 'https://github.com/hardd23/tea-timer/releases/tag/v2.0.0', updateAvailable: true, apk: { url: 'https://github.com/hardd23/tea-timer/releases/download/v2.0.0/Tea-Timer-2.0.0.apk', sha256: 'a'.repeat(64), size: 100 } });
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Open settings — Update available' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates — Update available' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Update app' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Open installation settings' }));
  await waitFor(() => expect(mocks.installer.requestPermission).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Installing the update…')).toBeTruthy();
});

it('preserves an ongoing download when the update screen is reopened', async () => {
  window.localStorage.setItem('tea-timer-language', 'en');
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  mocks.listener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.addListener.mockResolvedValue({ remove: vi.fn() });
  mocks.installer.getStatus.mockResolvedValue({ status: 'idle' });
  mocks.installer.install.mockResolvedValue({ status: 'installing' });
  let finishDownload!: () => void;
  mocks.installer.download.mockReturnValue(new Promise<void>((resolve) => { finishDownload = resolve; }));
  mocks.check.mockResolvedValue({ currentVersion: '1.0.0', latestVersion: '2.0.0', releaseUrl: 'https://github.com/hardd23/tea-timer/releases/tag/v2.0.0', updateAvailable: true, apk: { url: 'https://github.com/hardd23/tea-timer/releases/download/v2.0.0/Tea-Timer-2.0.0.apk', sha256: 'a'.repeat(64), size: 100 } });
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Open settings — Update available' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates — Update available' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Update app' }));
  await screen.findByText('Downloading and verifying the update…');
  fireEvent.click(screen.getByRole('button', { name: 'Close update check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open settings — Update available' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check for updates — Update available' }));
  expect(screen.getByText('Downloading and verifying the update…')).toBeTruthy();
  expect(mocks.check).toHaveBeenCalledTimes(2);
  finishDownload();
  await waitFor(() => expect(mocks.installer.install).toHaveBeenCalledTimes(1));
});
