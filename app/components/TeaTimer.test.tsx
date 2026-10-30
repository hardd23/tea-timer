// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from './LanguageContext';
import { TeaSessionProvider } from './TeaSessionContext';
import TeaTimer from './TeaTimer';
import SessionResetButton from './SessionResetButton';

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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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
