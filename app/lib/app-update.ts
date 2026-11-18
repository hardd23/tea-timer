import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  APP_VERSION,
  GITHUB_LATEST_RELEASE_API_URL,
  GITHUB_URL,
} from '../app-info';
import { compareVersions } from './version';

const UPDATE_REQUEST_TIMEOUT_MS = 10_000;
export const UPDATE_RETRY_INTERVAL_MS = 60_000;
const UPDATE_CHECK_INTERVAL_MS = 15 * UPDATE_RETRY_INTERVAL_MS;
const STABLE_RELEASE_TAG = /^v?\d+\.\d+\.\d+$/;
const RELEASE_PAGE_PREFIX = `${GITHUB_URL}/releases/tag/`;

class UpdateRequestError extends Error {
  constructor(status: number, readonly retryAt = 0) {
    super(`GitHub API returned ${status}`);
  }
}

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
  if (!Array.isArray(assets) || !STABLE_RELEASE_TAG.test(tag)) return undefined;
  const version = tag.replace(/^v/, '');
  const candidates = assets.filter((asset) => typeof asset?.name === 'string' && /\.apk$/i.test(asset.name));
  if (candidates.length !== 1) return undefined;
  const asset = candidates[0];
  if (asset.name !== `Tea-Timer-${version}.apk` || asset.state !== 'uploaded'
      || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 100_000_000
      || typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) return undefined;
  const expected = `${GITHUB_URL}/releases/download/${tag}/${asset.name}`;
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

export function createUpdateChecker(check = checkForAppUpdate, intervalMs = UPDATE_CHECK_INTERVAL_MS) {
  let inFlight: Promise<AppUpdateResult> | null = null;
  let nextCheckAt = -Infinity;
  return (force = false): Promise<AppUpdateResult | null> => {
    if (inFlight) return inFlight;
    if (!force && Date.now() < nextCheckAt) return Promise.resolve(null);
    inFlight = check().then((result) => {
      nextCheckAt = Date.now() + intervalMs;
      return result;
    }, (error: unknown) => {
      const retryAt = error instanceof UpdateRequestError ? error.retryAt : 0;
      nextCheckAt = Math.max(Date.now() + UPDATE_RETRY_INTERVAL_MS, retryAt);
      throw error;
    }).finally(() => { inFlight = null; });
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

async function fetchLatestRelease(): Promise<GitHubReleaseResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    UPDATE_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const retryAfter = Number(response.headers?.get('retry-after')) || 0;
      const reset = response.headers?.get('x-ratelimit-remaining') === '0'
        ? Number(response.headers.get('x-ratelimit-reset')) || 0 : 0;
      throw new UpdateRequestError(response.status, Math.max(
        Date.now() + retryAfter * 1000,
        reset * 1000,
      ));
    }

    return await response.json() as GitHubReleaseResponse;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchLatestReleasePage(): Promise<GitHubReleaseResponse> {
  const response = await CapacitorHttp.request({
    url: `${GITHUB_URL}/releases/latest`,
    method: 'HEAD',
    disableRedirects: true,
    connectTimeout: UPDATE_REQUEST_TIMEOUT_MS,
    readTimeout: UPDATE_REQUEST_TIMEOUT_MS,
  });
  const releaseUrl = Object.entries(response.headers).find(
    ([name]) => name.toLowerCase() === 'location',
  )?.[1];
  if (response.status < 300 || response.status >= 400 || !releaseUrl?.startsWith(RELEASE_PAGE_PREFIX)) {
    throw new Error('GitHub did not redirect to a trusted release page');
  }
  const tag = releaseUrl.slice(RELEASE_PAGE_PREFIX.length);
  if (!STABLE_RELEASE_TAG.test(tag)) throw new Error('GitHub release is not stable');
  return { tag_name: tag, html_url: releaseUrl };
}

export const checkForAppUpdate = async (): Promise<AppUpdateResult> => {
  const currentVersion = await getInstalledAppVersion();
  const release = await fetchLatestRelease().catch(async (error: unknown) => {
    if (!isAndroidApp()) throw error;
    try {
      return await fetchLatestReleasePage();
    } catch {
      throw error;
    }
  });

  if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') {
    throw new Error('GitHub release response is incomplete');
  }
  if (release.draft === true || release.prerelease === true || !STABLE_RELEASE_TAG.test(release.tag_name)) {
    throw new Error('GitHub release is not stable');
  }
  if (release.html_url !== `${RELEASE_PAGE_PREFIX}${release.tag_name}`) throw new Error('Untrusted release URL');

  const latestVersion = release.tag_name.replace(/^v/, '');
  const apk = selectReleaseApk(release.assets, release.tag_name);
  return {
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    updateAvailable: compareVersions(currentVersion, latestVersion) < 0,
    ...(apk ? { apk } : {}),
  };
};
