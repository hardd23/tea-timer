// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LanguageProvider } from './LanguageContext';
import { TeaSessionProvider } from './TeaSessionContext';
import TeaTimer from './TeaTimer';

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
