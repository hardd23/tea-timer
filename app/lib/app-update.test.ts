// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { APP_VERSION, GITHUB_LATEST_RELEASE_API_URL, GITHUB_URL } from '../app-info';
import { checkForAppUpdate, createUpdateChecker, getInstalledAppVersion, getUpdateInstaller, selectReleaseApk } from './app-update';

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn() },
  CapacitorHttp: { request: vi.fn() },
}));
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn() } }));

const releaseUrl = `${GITHUB_URL}/releases/tag/v2.0.0`;
const mockRelease = (tag_name: unknown) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ tag_name, html_url: `${GITHUB_URL}/releases/tag/${tag_name}` }),
  }));
};

describe('app updates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each([
    ['v999.0.0', '999.0.0', true],
    [APP_VERSION, APP_VERSION, false],
    ['0.0.0', '0.0.0', false],
  ])('checks release %s', async (tag, latestVersion, updateAvailable) => {
    mockRelease(tag);
    await expect(checkForAppUpdate()).resolves.toEqual({
      currentVersion: APP_VERSION, latestVersion, releaseUrl: `${GITHUB_URL}/releases/tag/${tag}`, updateAvailable,
    });
    expect(fetch).toHaveBeenCalledWith(GITHUB_LATEST_RELEASE_API_URL, expect.objectContaining({
      cache: 'no-store', signal: expect.any(AbortSignal),
    }));
  });

  it('reports an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(checkForAppUpdate()).rejects.toThrow('GitHub API returned 503');
  });

  it('does not expose the Android installer on the web or localhost', () => {
    expect(() => getUpdateInstaller()).toThrow('Android only');
  });

  it('selects only a uniquely named, uploaded and verifiable APK from this release', () => {
    const asset = {
      name: 'Tea-Timer-2.0.0.apk', state: 'uploaded', size: 100,
      digest: `sha256:${'a'.repeat(64)}`,
      browser_download_url: `${GITHUB_URL}/releases/download/v2.0.0/Tea-Timer-2.0.0.apk`,
    };
    expect(selectReleaseApk([asset], 'v2.0.0')).toEqual({ url: asset.browser_download_url, sha256: 'a'.repeat(64), size: 100 });
    expect(selectReleaseApk([asset, { ...asset, name: 'other.apk' }], 'v2.0.0')).toBeUndefined();
    expect(selectReleaseApk([{ ...asset, digest: null }], 'v2.0.0')).toBeUndefined();
    expect(selectReleaseApk([{ ...asset, browser_download_url: 'https://evil.example/a.apk' }], 'v2.0.0')).toBeUndefined();
    expect(selectReleaseApk([asset], 'v2.0.0-beta')).toBeUndefined();
  });

  it('coalesces automatic checks, retries sooner after a failure and throttles successful checks', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const result = { currentVersion: '2.0.0', latestVersion: '2.0.0', releaseUrl, updateAvailable: false };
    const check = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(result);
    const run = createUpdateChecker(check);
    const first = run();
    const simultaneous = run();
    expect(first).toBe(simultaneous);
    await expect(first).rejects.toThrow('offline');
    await expect(run()).resolves.toBeNull();
    clock.mockReturnValue(61_000);
    await expect(run()).resolves.toEqual(result);
    clock.mockReturnValue(121_000);
    await expect(run()).resolves.toBeNull();
    await expect(run(true)).resolves.toEqual(result);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('waits for the GitHub rate limit to reset before retrying automatically', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const fetchRelease = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '180' }),
    });
    vi.stubGlobal('fetch', fetchRelease);
    const run = createUpdateChecker();
    await expect(run()).rejects.toThrow('GitHub API returned 403');
    clock.mockReturnValue(61_000);
    await expect(run()).resolves.toBeNull();
    clock.mockReturnValue(180_000);
    await expect(run()).rejects.toThrow('GitHub API returned 403');
    expect(fetchRelease).toHaveBeenCalledTimes(2);
  });

  it('rejects prereleases and untrusted release pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_name: 'v2.0.0', html_url: releaseUrl, prerelease: true }) }));
    await expect(checkForAppUpdate()).rejects.toThrow('not stable');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_name: 'v2.0.0', html_url: 'https://evil.example/' }) }));
    await expect(checkForAppUpdate()).rejects.toThrow('Untrusted');
  });

  it.each([[undefined, releaseUrl], ['v2.0.0', undefined], [42, releaseUrl]])(
    'rejects incomplete release data', async (tag, url) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, json: async () => ({ tag_name: tag, html_url: url }),
      }));
      await expect(checkForAppUpdate()).rejects.toThrow('GitHub release response is incomplete');
    },
  );

  it('reads the installed Android version from App.getInfo', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(App.getInfo).mockResolvedValue({ name: 'Tea Timer', id: 'example', build: '1', version: '1.0.0' });
    await expect(getInstalledAppVersion()).resolves.toBe('1.0.0');
    mockRelease('v1.0.1');
    await expect(checkForAppUpdate()).resolves.toMatchObject({ currentVersion: '1.0.0', updateAvailable: true });
    expect(App.getInfo).toHaveBeenCalledTimes(2);
  });

  it.each([['1.0.0', true], ['2.0.0', false]] as const)(
    'checks the public release page if the API is rate limited (installed: %s)',
    async (version, updateAvailable) => {
      vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
      vi.mocked(App.getInfo).mockResolvedValue({ name: 'Tea Timer', id: 'example', build: '1', version });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
      vi.mocked(CapacitorHttp.request).mockResolvedValue({
        status: 302, headers: { Location: releaseUrl }, url: `${GITHUB_URL}/releases/latest`, data: '',
      });
      await expect(checkForAppUpdate()).resolves.toEqual({
        currentVersion: version, latestVersion: '2.0.0', releaseUrl, updateAvailable,
      });
      expect(CapacitorHttp.request).toHaveBeenCalledWith(expect.objectContaining({
        url: `${GITHUB_URL}/releases/latest`, method: 'HEAD', disableRedirects: true,
      }));
    },
  );

  it.each([
    'https://example.com/releases/tag/v2.0.0',
    `${GITHUB_URL}/releases/tag/v2.0.0-beta`,
  ])('rejects a fallback redirect to %s', async (location) => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(App.getInfo).mockResolvedValue({ name: 'Tea Timer', id: 'example', build: '1', version: '1.0.0' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    vi.mocked(CapacitorHttp.request).mockResolvedValue({
      status: 302, headers: { location }, url: `${GITHUB_URL}/releases/latest`, data: '',
    });
    await expect(checkForAppUpdate()).rejects.toThrow('GitHub API returned 403');
  });

  it.each([true, false])('clears the request timer after completion (success: %s)', async (success) => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    if (success) mockRelease(APP_VERSION);
    else vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    if (success) await checkForAppUpdate();
    else await expect(checkForAppUpdate()).rejects.toThrow('network error');
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(setTimeoutSpy.mock.results[0].value);
  });
});
