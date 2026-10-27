import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  APP_VERSION,
  GITHUB_LATEST_RELEASE_API_URL,
} from '../app-info';
import { compareVersions } from './version';

const UPDATE_REQUEST_TIMEOUT_MS = 10_000;

interface GitHubReleaseResponse {
  html_url?: unknown;
  tag_name?: unknown;
}

export interface AppUpdateResult {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  updateAvailable: boolean;
}

export const isAndroidApp = () => Capacitor.getPlatform() === 'android';

export const isUpdateCheckAvailable = () => {
  if (isAndroidApp()) return true;
  if (typeof window === 'undefined') return false;

  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
};

export const getInstalledAppVersion = async () => {
  if (!isAndroidApp()) return APP_VERSION;

  const appInfo = await App.getInfo();
  return appInfo.version;
};

export const checkForAppUpdate = async (): Promise<AppUpdateResult> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    UPDATE_REQUEST_TIMEOUT_MS,
  );

  try {
    const currentVersion = await getInstalledAppVersion();
    const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);

    const release = await response.json() as GitHubReleaseResponse;
    if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') {
      throw new Error('GitHub release response is incomplete');
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    const comparison = compareVersions(currentVersion, latestVersion);

    return {
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      updateAvailable: comparison < 0,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
};
