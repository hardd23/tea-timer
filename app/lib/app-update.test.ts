// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { APP_VERSION, GITHUB_LATEST_RELEASE_API_URL } from '../app-info';
import { checkForAppUpdate, getInstalledAppVersion } from './app-update';

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: vi.fn() } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn() } }));

const releaseUrl = 'https://github.com/example/project/releases/tag/v2.0.0';
const mockRelease = (tag_name: unknown) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ tag_name, html_url: releaseUrl }),
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
      currentVersion: APP_VERSION, latestVersion, releaseUrl, updateAvailable,
    });
    expect(fetch).toHaveBeenCalledWith(GITHUB_LATEST_RELEASE_API_URL, expect.objectContaining({
      cache: 'no-store', signal: expect.any(AbortSignal),
    }));
  });

  it('reports an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(checkForAppUpdate()).rejects.toThrow('GitHub API returned 503');
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
