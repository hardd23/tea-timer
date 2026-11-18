// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readWebTeaSession, TEA_SESSION_KEY } from '../lib/tea-session';
import { LanguageProvider } from './LanguageContext';
import SettingsMenu from './SettingsMenu';
import TeaTimer from './TeaTimer';
import { TeaSessionProvider } from './TeaSessionContext';

const play = vi.fn().mockResolvedValue(undefined);
const alertTimingLabel = 'Cooling time';
const mount = () => render(<LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>);
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const open = () => click('Open settings');
const close = () => click('Close settings');
const begin = () => click('Start');
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const returnAfter = (ms: number) => act(() => {
  vi.setSystemTime(Date.now() + ms);
  window.dispatchEvent(new Event('pageshow'));
});
const coolingSwitch = () => screen.getByRole('switch', { name: 'Cooling alert' });
const toggle = () => fireEvent.click(coolingSwitch());
const increase = () => click('Increase time until alert');
const decrease = () => click('Decrease time until alert');
const setMinutes = (minutes: number) => {
  open();
  for (let current = 3; current > minutes; current--) decrease();
  for (let current = 3; current < minutes; current++) increase();
  close();
};
const phase = (container: HTMLElement) => container.querySelector('.active-timer')?.getAttribute('data-phase');
const pours = (container: HTMLElement) => container.querySelector('.brew-counter-value')?.textContent;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  window.localStorage.setItem('tea-timer-language', 'en');
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  play.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('Audio', vi.fn(function () { return { play }; }));
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('lang');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('defaults to three minutes, clamps both buttons and restores a disabled setting without losing its duration', () => {
  const first = mount();
  open();
  expect(coolingSwitch().getAttribute('aria-checked')).toBe('true');
  expect(within(screen.getByRole('group', { name: alertTimingLabel })).getByText('3')).toBeTruthy();
  for (let attempt = 0; attempt < 5; attempt++) decrease();
  expect(within(screen.getByRole('group', { name: alertTimingLabel })).getByText('1')).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Decrease time until alert' }).disabled).toBe(true);
  for (let attempt = 0; attempt < 6; attempt++) increase();
  expect(within(screen.getByRole('group', { name: alertTimingLabel })).getByText('5')).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Increase time until alert' }).disabled).toBe(true);
  toggle();
  expect(screen.queryByRole('group', { name: alertTimingLabel })).toBeNull();
  first.unmount();
  mount();
  open();
  expect(coolingSwitch().getAttribute('aria-checked')).toBe('false');
  expect(screen.queryByRole('group', { name: alertTimingLabel })).toBeNull();
  toggle();
  expect(within(screen.getByRole('group', { name: alertTimingLabel })).getByText('5')).toBeTruthy();
});

it.each([1, 2, 3, 4, 5])('plays the second signal exactly once after %i minutes and keeps counting', (minutes) => {
  const view = mount();
  setMinutes(minutes);
  begin();
  advance(10_000);
  expect(play).toHaveBeenCalledTimes(1);
  expect(pours(view.container)).toBe('1');
  advance(minutes * 60_000 - 1000);
  expect(play).toHaveBeenCalledTimes(1);
  advance(1000);
  expect(play).toHaveBeenCalledTimes(2);
  expect(Audio).toHaveBeenNthCalledWith(1, '/notification.mp3');
  expect(Audio).toHaveBeenNthCalledWith(2, '/notification.mp3');
  expect(view.container.querySelector('.active-timer-progress-ready')).toBeTruthy();
  advance(5000);
  returnAfter(1000);
  expect(screen.getByLabelText(`-0${minutes}:06 cooling`)).toBeTruthy();
  expect(play).toHaveBeenCalledTimes(2);
  expect(pours(view.container)).toBe('1');
});

it('keeps counting cooling time without an alert when the setting is switched off during brewing', () => {
  const view = mount();
  begin();
  open();
  toggle();
  close();
  expect(phase(view.container)).toBe('brewing');
  advance(10_000);
  expect(play).toHaveBeenCalledTimes(1);
  expect(phase(view.container)).toBe('cooling');
  expect(pours(view.container)).toBe('1');
  returnAfter(5 * 60_000);
  expect(screen.getByLabelText('-05:00 cooling')).toBeTruthy();
  expect(view.container.querySelector('.active-timer-progress-ready')).toBeNull();
  expect(play).toHaveBeenCalledTimes(1);
  begin();
  expect(phase(view.container)).toBe('brewing');
});

it('takes the latest duration during brewing and keeps it fixed after cooling starts', () => {
  const view = mount();
  begin();
  setMinutes(1);
  advance(10_000);
  expect(readWebTeaSession()?.timer).toMatchObject({ phase: 'cooling', coolingDurationMs: 60_000 });
  open();
  increase();
  increase();
  close();
  advance(60_000);
  expect(play).toHaveBeenCalledTimes(2);
  expect(pours(view.container)).toBe('1');
  begin();
  advance(10_000);
  expect(readWebTeaSession()?.timer).toMatchObject({ phase: 'cooling', coolingDurationMs: 180_000 });
});

it.each(['off', 'stop', 'reset', 'next'] as const)('cancels the old cooling alert on %s', (action) => {
  const first = mount();
  setMinutes(1);
  begin();
  advance(10_000);
  returnAfter(55_000);
  if (action === 'off') {
    open();
    toggle();
    toggle();
    close();
  } else if (action === 'stop') click('Stop');
  else if (action === 'reset') {
    open();
    click('Reset tea session');
    advance(0);
    click('Reset');
  } else begin();
  const expectedPhase = action === 'next' ? 'brewing' : action === 'off' ? 'cooling' : 'idle';
  expect(phase(first.container)).toBe(expectedPhase);
  first.unmount();
  const reopened = mount();
  advance(5000);
  expect(play).toHaveBeenCalledTimes(1);
  expect(pours(reopened.container)).toBe(action === 'reset' ? '0' : '1');
  expect(phase(reopened.container)).toBe(expectedPhase);
  if (action === 'off') {
    expect(screen.getByLabelText('-01:00 cooling')).toBeTruthy();
    expect(readWebTeaSession()?.timer).toMatchObject({ coolingAlertEnabled: false });
    expect(reopened.container.querySelector('.active-timer-progress-ready')).toBeNull();
  }
  if (action === 'reset') expect(readWebTeaSession()?.coolingDurationMinutes).toBe(1);
});

it('handles background return and a recreated WebView without replaying old signals or counting twice', () => {
  const first = mount();
  setMinutes(1);
  begin();
  advance(10_000);
  returnAfter(30_000);
  expect(screen.getByLabelText('-00:30 cooling')).toBeTruthy();
  first.unmount();

  const pending = mount();
  expect(readWebTeaSession()?.timer).toMatchObject({ coolingDurationMs: 60_000, coolingAlertHandled: false });
  returnAfter(30_000);
  expect(play).toHaveBeenCalledTimes(2);
  expect(readWebTeaSession()?.timer).toMatchObject({ coolingAlertHandled: true });
  pending.unmount();
  mount();
  returnAfter(30_000);
  expect(screen.getByLabelText('-01:30 cooling')).toBeTruthy();
  expect(play).toHaveBeenCalledTimes(2);
  expect(readWebTeaSession()?.pourCount).toBe(1);
});

it('drops overdue sounds on cold restore and keeps an older snapshot with invalid cooling options', () => {
  const first = mount();
  begin();
  const saved = readWebTeaSession()!;
  first.unmount();
  window.localStorage.setItem(TEA_SESSION_KEY, JSON.stringify({
    ...saved, coolingEnabled: 'off', coolingDurationMinutes: 900,
  }));
  vi.setSystemTime(Date.now() + 200_000);
  const reopened = mount();
  expect(screen.getByLabelText('-03:10 cooling')).toBeTruthy();
  expect(pours(reopened.container)).toBe('1');
  expect(readWebTeaSession()).toMatchObject({
    coolingEnabled: true, coolingDurationMinutes: 3,
    timer: { id: saved.timer?.id, coolingDurationMs: 180_000, coolingAlertHandled: true },
  });
  expect(play).not.toHaveBeenCalled();
});

it('keeps brewing and cooling functional if the sound fails to play', () => {
  play.mockRejectedValue(new Error('unavailable'));
  const view = mount();
  begin();
  advance(10_000);
  advance(180_000);
  expect(phase(view.container)).toBe('cooling');
  expect(pours(view.container)).toBe('1');
  expect(play).toHaveBeenCalledTimes(2);
});
