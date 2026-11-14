import { App } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  APP_VERSION,
  GITHUB_LATEST_RELEASE_API_URL,
} from '../app-info';
import { compareVersions } from './version';

const UPDATE_REQUEST_TIMEOUT_MS = 10_000;

interface GitHubReleaseResponse {
  html_url?: unknown;
  tag_name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
}

export interface UpdateAsset { url: string; sha256: string; size: number }

export interface AppUpdateResult {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  updateAvailable: boolean;
  apk?: UpdateAsset;
}

export function selectReleaseApk(assets: unknown, tag: string): UpdateAsset | undefined {
  if (!Array.isArray(assets) || !/^v?\d+\.\d+\.\d+$/.test(tag)) return undefined;
  const version = tag.replace(/^v/, '');
  const candidates = assets.filter((asset) => typeof asset?.name === 'string' && /\.apk$/i.test(asset.name));
  if (candidates.length !== 1) return undefined;
  const asset = candidates[0];
  if (asset.name !== `Tea-Timer-${version}.apk` || asset.state !== 'uploaded'
      || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 100_000_000
      || typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) return undefined;
  const expected = `${GITHUB_LATEST_RELEASE_API_URL.replace('api.github.com/repos', 'github.com').replace('/releases/latest', '')}/releases/download/${tag}/${asset.name}`;
  if (asset.browser_download_url !== expected) return undefined;
  return { url: expected, sha256: asset.digest.slice(7).toLowerCase(), size: asset.size };
}

export type InstallStatus = 'idle' | 'installing' | 'confirmationRequired' | 'success' | 'failed';
interface UpdateInstaller {
  download(asset: UpdateAsset): Promise<void>;
  install(): Promise<{ status: 'permissionRequired' | 'installing' }>;
  requestPermission(): Promise<{ status: 'permissionRequired' | 'installing' }>;
  getStatus(): Promise<{ status: InstallStatus }>;
  continueInstall(): Promise<{ status: 'confirmationRequired' | 'installing' }>;
  addListener(eventName: 'installStatus', listener: (event: { status: InstallStatus }) => void): Promise<PluginListenerHandle>;
}

export function getUpdateInstaller(): UpdateInstaller {
  if (!isAndroidApp()) throw new Error('Android only');
  return registerPlugin<UpdateInstaller>('TeaUpdateInstaller');
}

export function createUpdateChecker(check = checkForAppUpdate, intervalMs = 6 * 60 * 60 * 1000) {
  let inFlight: Promise<AppUpdateResult> | null = null;
  let lastAttempt = -Infinity;
  return (force = false): Promise<AppUpdateResult | null> => {
    if (inFlight) return inFlight;
    if (!force && Date.now() - lastAttempt < intervalMs) return Promise.resolve(null);
    lastAttempt = Date.now();
    inFlight = check().finally(() => { inFlight = null; });
    return inFlight;
  };
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
    if (release.draft === true || release.prerelease === true || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)) {
      throw new Error('GitHub release is not stable');
    }
    const expectedReleaseUrl = `${GITHUB_LATEST_RELEASE_API_URL.replace('api.github.com/repos', 'github.com').replace('/releases/latest', '')}/releases/tag/${release.tag_name}`;
    if (release.html_url !== expectedReleaseUrl) throw new Error('Untrusted release URL');

    const latestVersion = release.tag_name.replace(/^v/, '');
    const comparison = compareVersions(currentVersion, latestVersion);

    const apk = selectReleaseApk(release.assets, release.tag_name);
    return {
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      updateAvailable: comparison < 0,
      ...(apk ? { apk } : {}),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
};
