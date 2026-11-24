// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getTimerSound, TIMER_SOUNDS } from '../lib/timer-sounds';
import { emptyTeaSession, readWebTeaSession, writeWebTeaSession } from '../lib/tea-session';
import { LanguageProvider } from './LanguageContext';
import SettingsMenu from './SettingsMenu';
import { TeaSessionProvider } from './TeaSessionContext';
import TeaTimer from './TeaTimer';

const play = vi.fn<() => Promise<void>>();
const pause = vi.fn();
const audio = vi.fn(function (url: string) {
  return { url, play: () => play(), pause: () => pause(url), onended: null as (() => void) | null };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  play.mockResolvedValue(undefined);
  window.localStorage.setItem('tea-timer-language', 'en');
  vi.stubGlobal('Audio', audio);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.resetAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const renderSettings = () => render(
  <LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>,
);
const button = (name: string) => screen.getByRole('button', { name });
const picker = () => within(screen.getByRole('dialog', { name: 'Select sound' }));

it('selects sounds independently and restores both choices on reload', () => {
  const view = renderSettings();
  fireEvent.click(button('Open settings'));
  fireEvent.click(button('Brewing complete Short Bowl'));
  expect(picker().getByRole('button', { name: 'Short Bowl' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(picker().getByRole('button', { name: 'No sound' }));
  fireEvent.click(button('Cooling complete Short Bowl'));
  fireEvent.click(picker().getByRole('button', { name: 'Long Gong' }));
  expect(readWebTeaSession()?.sounds).toEqual({ brewing: 'silent', cooling: 'gong_soft' });

  view.unmount();
  renderSettings();
  fireEvent.click(button('Open settings'));
  expect(button('Brewing complete No sound')).toBeTruthy();
  fireEvent.click(button('Cooling complete Long Gong'));
  expect(picker().getByRole('button', { name: 'Long Gong' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(picker().getByRole('button', { name: 'No sound' }));
  expect(readWebTeaSession()?.sounds).toEqual({ brewing: 'silent', cooling: 'silent' });
});

it('previews each sound and stops the previous recording on switch and close', () => {
  renderSettings();
  fireEvent.click(button('Open settings'));
  fireEvent.click(button('Brewing complete Short Bowl'));
  const labels = ['Short Bowl', 'Low Bowl', 'Short Gong', 'Long Gong'];
  expect(picker().getAllByRole('listitem').map((row) => row.querySelector('button[aria-pressed]')?.textContent?.replace('✓', '')))
    .toEqual(['No sound', ...labels]);
  expect(picker().queryByRole('button', { name: 'Preview: No sound' })).toBeNull();
  for (const label of labels) {
    fireEvent.click(picker().getByRole('button', { name: `Preview: ${label}` }));
  }
  const urls = TIMER_SOUNDS.flatMap(({ url }) => url ? [url] : []);
  expect(audio.mock.calls.flat()).toEqual(urls);
  expect(pause.mock.calls.flat()).toEqual(urls.slice(0, -1));
  fireEvent.click(button('Close sound picker'));
  expect(pause.mock.calls.flat()).toEqual(urls);
  expect(readWebTeaSession()).toBeNull();
});

it('falls back to the original recording if a preview cannot play', async () => {
  play.mockRejectedValueOnce(new Error('media unavailable'));
  renderSettings();
  fireEvent.click(button('Open settings'));
  fireEvent.click(button('Brewing complete Short Bowl'));
  await act(async () => { fireEvent.click(button('Preview: Short Gong')); });
  expect(audio.mock.calls.flat()).toEqual([getTimerSound('gong_clear').url, getTimerSound('default').url]);
});

const soundCases = (['visible', 'hidden'] as const).flatMap((visibility) => TIMER_SOUNDS.flatMap((brewing) =>
  TIMER_SOUNDS.map((cooling) => ({ brewing, cooling, visibility }))));

it.each(soundCases)('handles brewing $brewing.id and cooling $cooling.id in a $visibility tab', ({ brewing, cooling, visibility }) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibility);
  writeWebTeaSession({ ...emptyTeaSession(), coolingDurationMinutes: 1,
    sounds: { brewing: brewing.id, cooling: cooling.id } });
  renderSettings();
  fireEvent.click(button('Start'));
  act(() => { vi.advanceTimersByTime(10_000); });
  const brewSounds = brewing.url ? [brewing.url] : [];
  expect(audio.mock.calls.flat()).toEqual(brewSounds);
  expect(readWebTeaSession()?.pourCount).toBe(1);
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(audio.mock.calls.flat()).toEqual(cooling.url ? [...brewSounds, cooling.url] : brewSounds);
  expect(screen.getByLabelText('-01:00 cooling')).toBeTruthy();
  expect(readWebTeaSession()?.timer).toMatchObject({ phase: 'cooling', coolingAlertEnabled: true, coolingAlertHandled: true });
  if (brewing.url) expect(pause).toHaveBeenCalledWith(brewing.url);
});

it('gives the timer priority over both a running preview and a new preview request', () => {
  renderSettings();
  fireEvent.click(button('Start'));
  fireEvent.click(button('Open settings'));
  fireEvent.click(button('Cooling complete Short Bowl'));
  fireEvent.click(button('Preview: Low Bowl'));

  act(() => { vi.advanceTimersByTime(10_000); });
  expect(pause.mock.calls.flat()).toEqual([getTimerSound('singing_bowl').url]);
  expect(audio.mock.calls.flat()).toEqual([getTimerSound('singing_bowl').url, getTimerSound('default').url]);
  fireEvent.click(button('Preview: Long Gong'));
  expect(audio).toHaveBeenCalledTimes(2);

  act(() => { audio.mock.results[1].value.onended(); });
  fireEvent.click(button('Preview: Long Gong'));
  expect(audio).toHaveBeenLastCalledWith(getTimerSound('gong_soft').url);
});

it('plays at the cooling deadline between display ticks and ignores subsequent completion callbacks', () => {
  const endAt = Date.now() - 60_000 + 375;
  writeWebTeaSession({ ...emptyTeaSession(), sessionId: 'session', pourCount: 1,
    sounds: { brewing: 'default', cooling: 'gong_clear' },
    timer: { id: 'brew', phase: 'cooling', startedAt: endAt - 10_000, endAt, duration: 10,
      coolingDurationMs: 60_000, coolingAlertEnabled: true, coolingAlertHandled: false } });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  renderSettings();

  act(() => { vi.advanceTimersByTime(374); });
  expect(play).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(1); });
  expect(audio).toHaveBeenCalledExactlyOnceWith(getTimerSound('gong_clear').url);
  act(() => {
    window.dispatchEvent(new Event('pageshow'));
    vi.advanceTimersByTime(3000);
  });
  expect(play).toHaveBeenCalledTimes(1);
});
