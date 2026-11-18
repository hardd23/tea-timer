// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, type AppState } from '@capacitor/app';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from './LanguageContext';
import { TeaSessionProvider } from './TeaSessionContext';
import TeaTimer from './TeaTimer';
import SessionResetButton from './SessionResetButton';
import SettingsMenu from './SettingsMenu';
import TeaWisdom from './TeaWisdom';
import Home from '../page';
import { DiaryProvider } from './DiaryContext';
import { readDiary, writeDiaryEvent } from '../lib/tea-diary-storage';
import * as sessionStorage from '../lib/tea-session';

vi.mock('@capacitor/app', () => ({
  App: { addListener: async () => ({ remove: async () => {} }) },
}));

const play = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  window.localStorage.setItem('tea-timer-language', 'en');
  play.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('Audio', vi.fn(function () { return { play }; }));
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-color-theme');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it('keeps the diary inaccessible and does not open its storage during app use', () => {
  const open = vi.fn();
  vi.stubGlobal('indexedDB', { open });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  render(<Home />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  expect(screen.queryByRole('button', { name: /tea session history|история чаепитий/i })).toBeNull();
  expect(open).not.toHaveBeenCalled();
});

it.each(['Light', 'Dark'])('changes color themes independently in %s mode', (mode) => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(screen.getByRole('button', { name: mode }));
  for (const [name, value] of [['Tea leaf', 'leaf'], ['Warm amber', 'amber'], ['Plum', 'plum']]) {
    const choice = screen.getByRole('button', { name });
    fireEvent.click(choice);
    expect(choice.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem('tea-timer-color-theme')).toBe(value);
    expect(document.documentElement.dataset.colorTheme).toBe(value);
    expect(document.documentElement.dataset.theme).toBe(mode.toLowerCase());
  }
});

it('saves the seconds step and applies it to the timer wheel', () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const view = render(
    <LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(screen.getByRole('button', { name: '5 sec' }));
  expect(window.localStorage.getItem('tea-timer-seconds-step')).toBe('5');
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  const wheel = screen.getByRole('spinbutton', { name: 'sec' });
  fireEvent.keyDown(wheel, { key: 'ArrowDown' });
  expect(wheel.getAttribute('aria-valuenow')).toBe('5');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByLabelText('00:05 remaining')).toBeTruthy();
  view.unmount();
  render(<LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  const restoredWheel = screen.getByRole('spinbutton', { name: 'sec' });
  fireEvent.keyDown(restoredWheel, { key: 'End' });
  expect(restoredWheel.getAttribute('aria-valuenow')).toBe('55');
});

it.each([10, 5])('carries seconds across minutes in both directions with a %i-second step', (step) => {
  window.localStorage.setItem('tea-timer-seconds-step', String(step));
  render(<LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  const minutes = screen.getByRole('spinbutton', { name: 'min' });
  const seconds = screen.getByRole('spinbutton', { name: 'sec' });
  fireEvent.keyDown(seconds, { key: 'End' });
  expect(seconds.getAttribute('aria-valuenow')).toBe(String(60 - step));
  fireEvent.keyDown(seconds, { key: 'ArrowUp' });
  expect(minutes.getAttribute('aria-valuenow')).toBe('1');
  expect(seconds.getAttribute('aria-valuenow')).toBe('0');
  fireEvent.keyDown(seconds, { key: 'ArrowDown' });
  expect(minutes.getAttribute('aria-valuenow')).toBe('0');
  expect(seconds.getAttribute('aria-valuenow')).toBe(String(60 - step));
});

it('keeps one reel in sync when direction changes before animation finishes', () => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(140);
  vi.stubGlobal('DOMMatrixReadOnly', class {
    m42: number;
    constructor(transform: string) { this.m42 = Number.parseFloat(transform.match(/-?[\d.]+/)?.[0] ?? '0'); }
  });
  const animations: Array<{ cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }> = [];
  const animate = vi.fn(() => {
    const animation = { cancel: vi.fn(), onfinish: null };
    animations.push(animation);
    return animation;
  });
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
  try {
    render(<LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>);
    const seconds = screen.getByRole('spinbutton', { name: 'sec' });
    fireEvent.keyDown(seconds, { key: 'ArrowUp' });
    fireEvent.keyDown(seconds, { key: 'ArrowDown' });
    expect(seconds.getAttribute('aria-valuenow')).toBe('10');
    expect(animations[0].cancel).toHaveBeenCalled();
    expect(seconds.querySelectorAll('[data-index="0"]')).toHaveLength(1);
    act(() => animations[1].onfinish?.());
    expect(seconds.querySelectorAll('.time-wheel-number')).toHaveLength(1);
    expect(seconds.querySelector('.time-wheel-number')?.textContent).toBe('10');
  } finally {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  }
});

it('keeps the timer running while the full-screen dialogs are open', () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  render(
    <LanguageProvider><TeaSessionProvider><TeaWisdom /><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open tea wisdom' }));
  const quoteDialog = screen.getByRole('dialog');
  expect(quoteDialog.classList.contains('app-dialog-fullscreen')).toBe(true);
  const quote = quoteDialog.querySelector('blockquote');
  const firstQuote = quote?.textContent;
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByLabelText('00:05 remaining')).toBeTruthy();
  act(() => { vi.advanceTimersByTime(5000); });
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  expect(quote?.textContent).not.toBe(firstQuote);
  fireEvent.click(screen.getByRole('button', { name: 'Close tea wisdom' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  expect(screen.getByRole('dialog').classList.contains('app-dialog-fullscreen')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '5 sec' }));
  expect(window.localStorage.getItem('tea-timer-seconds-step')).toBe('5');
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByLabelText('-00:05 cooling')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('preserves a running timer when appearance and time-step settings change and the app returns to the foreground', () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => { vi.advanceTimersByTime(2000); });
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
  fireEvent.click(screen.getByRole('button', { name: 'Plum' }));
  fireEvent.click(screen.getByRole('button', { name: '5 sec' }));
  expect(screen.getByLabelText('00:08 remaining')).toBeTruthy();
  vi.setSystemTime(new Date('2026-01-01T00:00:12Z'));
  act(() => { window.dispatchEvent(new Event('pageshow')); });
  expect(screen.getByLabelText('-00:02 cooling')).toBeTruthy();
});

it('keeps the selected step for the session when storage writes fail', () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  fireEvent.click(screen.getByRole('button', { name: '5 sec' }));
  expect(screen.getByRole('button', { name: '5 sec' }).getAttribute('aria-pressed')).toBe('true');
  write.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: '10 sec' }));
});

it('normalizes the selected seconds when another tab changes the step', () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  render(<LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(screen.getByRole('button', { name: '5 sec' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
  const seconds = screen.getByRole('spinbutton', { name: 'sec' });
  fireEvent.keyDown(seconds, { key: 'ArrowUp' });
  expect(seconds.getAttribute('aria-valuenow')).toBe('15');
  window.localStorage.setItem('tea-timer-seconds-step', '10');
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'tea-timer-seconds-step', newValue: '10' })); });
  expect(seconds.getAttribute('aria-valuenow')).toBe('10');
  expect(seconds.getAttribute('aria-valuemax')).toBe('50');
});

it('respects the quote cooldown across reopening and background time', () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  render(<LanguageProvider><TeaSessionProvider><TeaWisdom /></TeaSessionProvider></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Open tea wisdom' }));
  const more = screen.getByRole('button', { name: 'More' }) as HTMLButtonElement;
  const quote = document.querySelector('#tea-wisdom-title');
  const firstQuote = quote?.textContent;
  expect(more.disabled).toBe(true);
  expect(more.style.getPropertyValue('--quote-progress')).toBe('0');
  fireEvent.click(more);
  expect(quote?.textContent).toBe(firstQuote);
  act(() => { vi.advanceTimersByTime(4000); });
  expect(Number(more.style.getPropertyValue('--quote-progress'))).toBeCloseTo(0.4);
  fireEvent.click(screen.getByRole('button', { name: 'Close tea wisdom' }));
  act(() => { vi.advanceTimersByTime(3000); });
  fireEvent.click(screen.getByRole('button', { name: 'Open tea wisdom' }));
  expect(quote?.textContent).toBe(firstQuote);
  expect(more.disabled).toBe(true);
  vi.setSystemTime(new Date('2026-01-01T00:00:11Z'));
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(more.disabled).toBe(false);
  fireEvent.click(more);
  expect(quote?.textContent).not.toBe(firstQuote);
  expect(more.disabled).toBe(true);
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(more.disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Close tea wisdom' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open tea wisdom' }));
  expect(more.disabled).toBe(false);
});

it.each([
  ['en', 'No active timers', 'Tea is brewing', 'Tea is cooling', 'Start'],
  ['ru', 'Нет активных таймеров', 'Чай заваривается', 'Чай остывает', 'Старт'],
])('shows the correct timer status in %s', (language, idle, brewing, cooling, start) => {
  window.localStorage.setItem('tea-timer-language', language);
  const { container } = render(
    <LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>,
  );
  const label = container.querySelector('.active-timer-label');
  const field = container.querySelector('.active-timer');
  expect(label?.textContent).toBe(idle);
  expect(label?.getAttribute('data-phase')).toBe('idle');
  expect(field?.querySelector('output')?.textContent).toBe('');
  fireEvent.click(screen.getByRole('button', { name: start }));
  expect(label?.textContent).toBe(brewing);
  expect(label?.getAttribute('data-phase')).toBe('brewing');
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(label?.textContent).toBe(cooling);
  expect(label?.getAttribute('data-phase')).toBe('cooling');
});

it('redraws the current Canvas phase with its CSS color on theme changes', () => {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const { container } = render(
    <LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>,
  );
  const canvas = container.querySelector('canvas')!;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 160, 88));
  canvas.style.setProperty('--color-brewing-progress', '#88d982');
  canvas.style.setProperty('--color-text-primary', '#263229');

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(context.strokeStyle).toBe('#88d982');
  expect(context.lineTo.mock.calls[0]).toEqual([12, 1]);

  canvas.style.setProperty('--color-brewing-progress', '#c58a3a');
  act(() => { window.dispatchEvent(new Event('tea-timer-color-theme-change')); });
  expect(context.strokeStyle).toBe('#c58a3a');

  act(() => { vi.advanceTimersByTime(10_000); });
  context.lineTo.mockClear();
  act(() => { vi.advanceTimersByTime(1000); });
  expect(context.strokeStyle).toBe('#263229');
  expect(context.lineTo.mock.calls[0]).toEqual([148, 1]);

  vi.setSystemTime(new Date('2026-01-01T00:03:10Z'));
  act(() => { window.dispatchEvent(new Event('pageshow')); });
  expect(canvas.classList.contains('active-timer-progress-ready')).toBe(true);

  canvas.style.setProperty('--color-text-primary', '#e8eae8');
  act(() => { window.dispatchEvent(new Event('tea-timer-theme-change')); });
  expect(context.strokeStyle).toBe('#e8eae8');
  expect(canvas.classList.contains('active-timer-progress-ready')).toBe(true);

  canvas.style.setProperty('--color-brewing-progress', '#dbadd5');
  act(() => { window.dispatchEvent(new Event('tea-timer-color-theme-change')); });
  expect(context.strokeStyle).toBe('#e8eae8');
});

it('brews for ten seconds, then starts cooling and records one pour', () => {
  const { container } = render(
    <LanguageProvider>
      <TeaSessionProvider>
        <TeaTimer />
      </TeaSessionProvider>
    </LanguageProvider>,
  );

  expect(screen.getByRole('region', { name: 'Tea timer controls' })).toBeTruthy();
  expect(screen.getByRole('spinbutton', { name: 'sec' }).getAttribute('aria-valuenow')).toBe('10');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('0');

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('brewing');
  expect(screen.getByLabelText('00:10 remaining').textContent).toBe('00:10');

  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByLabelText('00:05 remaining').textContent).toBe('00:05');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('0');
  expect(play).not.toHaveBeenCalled();

  act(() => { vi.advanceTimersByTime(5000); });
  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('cooling');
  expect(screen.getByLabelText('00:00 cooling').textContent).toBe('00:00');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(play).toHaveBeenCalledTimes(1);
});

it('does not repeat completion after an interval followed by page events', () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const { container } = render(
    <LanguageProvider>
      <TeaSessionProvider>
        <TeaTimer />
      </TeaSessionProvider>
    </LanguageProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('cooling');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(play).toHaveBeenCalledTimes(1);

  act(() => {
    for (let i = 0; i < 3; i += 1) {
      window.dispatchEvent(new Event('pageshow'));
      document.dispatchEvent(new Event('visibilitychange'));
    }
    vi.advanceTimersByTime(3000);
  });

  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('cooling');
  expect(screen.getByLabelText('-00:03 cooling').textContent).toBe('-00:03');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(play).toHaveBeenCalledTimes(1);
});

it('does not repeat completion when page events precede the interval', () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const { container } = render(
    <LanguageProvider>
      <TeaSessionProvider>
        <TeaTimer />
      </TeaSessionProvider>
    </LanguageProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  vi.setSystemTime(new Date('2026-01-01T00:00:11Z'));
  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('brewing');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('0');
  expect(play).not.toHaveBeenCalled();

  act(() => {
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));
  });

  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('cooling');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(play).toHaveBeenCalledTimes(1);

  act(() => { vi.advanceTimersByTime(1000); });
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(play).toHaveBeenCalledTimes(1);
});

it('catches up after returning from the background', () => {
  const { container } = render(
    <LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  vi.setSystemTime(new Date('2026-01-01T00:02:10Z'));
  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('brewing');
  act(() => { window.dispatchEvent(new Event('pageshow')); });

  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('cooling');
  expect(screen.getByLabelText('-02:00 cooling').textContent).toBe('-02:00');
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(play).toHaveBeenCalledTimes(1);
});

it('does not complete a timer stopped before brewing ends', () => {
  const { container } = render(
    <LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => { vi.advanceTimersByTime(5000); });
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  act(() => { vi.advanceTimersByTime(10_000); });

  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('idle');
  expect(screen.getByLabelText('No active timers')).toBeTruthy();
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('0');
  expect(play).not.toHaveBeenCalled();
});

it('resets the tea session after a completed brew', () => {
  const { container } = render(
    <LanguageProvider>
      <TeaSessionProvider><SessionResetButton /><TeaTimer /></TeaSessionProvider>
    </LanguageProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => { vi.advanceTimersByTime(10_000); });
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('cooling');
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'sec' }), { key: 'ArrowUp' });
  expect(screen.getByRole('spinbutton', { name: 'sec' }).getAttribute('aria-valuenow')).toBe('20');
  fireEvent.click(screen.getByRole('button', { name: 'Start a new tea session' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('idle');
  expect(screen.getByLabelText('No active timers')).toBeTruthy();
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('0');
  expect(screen.getByRole('spinbutton', { name: 'sec' }).getAttribute('aria-valuenow')).toBe('10');
  act(() => { vi.advanceTimersByTime(20_000); });
  expect(container.querySelector('.brew-counter-value')?.textContent).toBe('0');
  expect(container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('idle');
  expect(play).toHaveBeenCalledTimes(1);
});

const renderSession = () => render(
  <LanguageProvider><TeaSessionProvider><SettingsMenu /><TeaTimer /></TeaSessionProvider></LanguageProvider>,
);

it('restores the selected duration, same timer and remaining time after a web reload', () => {
  const first = renderSession();
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'sec' }), { key: 'ArrowUp' });
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  const saved = sessionStorage.readWebTeaSession();
  expect(saved?.timer).toMatchObject({ duration: 20, phase: 'brewing' });

  const write = vi.spyOn(Storage.prototype, 'setItem');
  act(() => { vi.advanceTimersByTime(4000); });
  expect(write.mock.calls.filter(([key]) => key === sessionStorage.TEA_SESSION_KEY)).toHaveLength(0);
  first.unmount();
  vi.setSystemTime(new Date('2026-01-01T00:00:08Z'));
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.dataset.colorTheme = 'plum';
  renderSession();

  expect(screen.getByLabelText('00:12 remaining')).toBeTruthy();
  expect(screen.getByRole('spinbutton', { name: 'sec' }).getAttribute('aria-valuenow')).toBe('20');
  expect(sessionStorage.readWebTeaSession()?.timer?.id).toBe(saved?.timer?.id);
  expect(document.documentElement.dataset.colorTheme).toBe('plum');
  expect(play).not.toHaveBeenCalled();
});

it('reconciles an expired brew once across repeated reloads and a long absence', () => {
  const first = renderSession();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  first.unmount();
  vi.setSystemTime(new Date('2026-01-01T00:00:40Z'));
  const second = renderSession();
  expect(screen.getByLabelText('-00:30 cooling')).toBeTruthy();
  expect(second.container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  second.unmount();

  vi.setSystemTime(new Date('2026-01-01T00:47:30Z'));
  const third = renderSession();
  expect(screen.getByLabelText('-47:20 cooling')).toBeTruthy();
  expect(third.container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  expect(play).not.toHaveBeenCalled();
});

it('keeps a stopped session and its count, then discards them after a confirmed reset', () => {
  const first = renderSession();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => { vi.advanceTimersByTime(10_000); });
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  first.unmount();

  const second = render(<LanguageProvider><TeaSessionProvider><SessionResetButton /><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  expect(second.container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('idle');
  expect(second.container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start a new tea session' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  second.unmount();

  const third = renderSession();
  expect(third.container.querySelector('.active-timer')?.getAttribute('data-phase')).toBe('idle');
  expect(third.container.querySelector('.brew-counter-value')?.textContent).toBe('0');
  expect(sessionStorage.readWebTeaSession()).toMatchObject({ sessionId: null, timer: null, durationSeconds: 10 });
});

it.each(['invalid JSON', JSON.stringify({
  ...sessionStorage.emptyTeaSession(), sessionId: 'session', pourCount: 3,
  timer: { id: 'timer', duration: 10, startedAt: 1000, endAt: 1200, phase: 'brewing' },
})])('ignores damaged saved data and permits a new tea session', (payload) => {
  window.localStorage.setItem(sessionStorage.TEA_SESSION_KEY, payload);
  const view = renderSession();
  expect(view.container.querySelector('.brew-counter-value')?.textContent).toBe('0');
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(sessionStorage.readWebTeaSession()?.timer?.duration).toBe(10);
});

it('waits for native restoration and immediately reconciles time on Capacitor resume', async () => {
  vi.spyOn(sessionStorage, 'usesNativeTeaSession').mockReturnValue(true);
  const listeners = new Set<(state: AppState) => void>();
  vi.spyOn(App, 'addListener').mockImplementation(async (_name, handler) => {
    const onState = handler as unknown as (state: AppState) => void;
    listeners.add(onState);
    return { remove: async () => { listeners.delete(onState); } };
  });
  let load!: (saved: sessionStorage.SavedTeaSession) => void;
  const read = vi.spyOn(sessionStorage, 'readNativeTeaSession')
    .mockImplementationOnce(() => new Promise((resolve) => { load = resolve; }));
  const write = vi.spyOn(sessionStorage, 'writeNativeTeaSession').mockResolvedValue(undefined);
  const startedAt = Date.now() - 2000;
  const saved: sessionStorage.SavedTeaSession = {
    ...sessionStorage.emptyTeaSession(), sessionId: 'native-session',
    timer: { id: 'native-timer', startedAt, endAt: startedAt + 10000, duration: 10, phase: 'brewing' },
  };
  const first = render(<LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>);
  expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  expect(write).not.toHaveBeenCalled();
  await act(async () => { load(saved); });
  expect(screen.getByLabelText('00:08 remaining')).toBeTruthy();

  vi.setSystemTime(startedAt + 14_000);
  await act(async () => { listeners.forEach((listener) => listener({ isActive: true })); });
  expect(screen.getByLabelText('-00:04 cooling')).toBeTruthy();
  expect(write).toHaveBeenCalledTimes(1);
  const committed = write.mock.calls[0][0];
  expect(committed.timer?.phase).toBe('cooling');
  first.unmount();
  read.mockResolvedValueOnce(committed);
  await act(async () => { render(<LanguageProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></LanguageProvider>); });
  expect(screen.getByLabelText('-00:04 cooling')).toBeTruthy();
  expect(write).toHaveBeenCalledTimes(1);
});

it('replays a pending completion alongside existing IndexedDB history without counting twice', async () => {
  vi.useRealTimers();
  vi.stubGlobal('indexedDB', new IDBFactory());
  const endAt = Date.now() - 40 * 60_000;
  const startedAt = endAt - 10_000;
  await writeDiaryEvent({ type: 'start', id: 'archive', at: startedAt - 30_000, duration: 10, timerId: 'archived' });
  await writeDiaryEvent({ type: 'reset', id: 'archive-reset', at: startedAt - 5000 });
  const start = { type: 'start', id: 'start:saved-brew', timerId: 'saved-brew', sessionId: 'saved-session', at: startedAt, duration: 10 } as const;
  const done = { type: 'complete', id: 'complete:saved-brew', timerId: 'saved-brew', sessionId: 'saved-session', at: endAt } as const;
  await writeDiaryEvent(start);
  await writeDiaryEvent(done);
  sessionStorage.writeWebTeaSession({
    ...sessionStorage.emptyTeaSession(), sessionId: start.sessionId, pourCount: 1,
    timer: { id: start.timerId, duration: 10, startedAt, endAt, phase: 'cooling', coolingDurationMs: 180_000, coolingAlertEnabled: true, coolingAlertHandled: false },
    pendingDiary: [start, done],
  });
  const view = render(<LanguageProvider><DiaryProvider><TeaSessionProvider><TeaTimer /></TeaSessionProvider></DiaryProvider></LanguageProvider>);
  await waitFor(() => expect(sessionStorage.readWebTeaSession()?.pendingDiary).toEqual([]));
  expect(view.container.querySelector('.brew-counter-value')?.textContent).toBe('1');
  const state = await readDiary();
  expect(state.activeId).toBe(start.sessionId);
  expect(state.sessions.map((item) => item.id)).toEqual(['archive', start.sessionId]);
  expect(state.sessions[1].actions.filter((action) => action.type === 'complete')).toHaveLength(1);
  expect(state.sessions[1].count).toBe(1);
});
