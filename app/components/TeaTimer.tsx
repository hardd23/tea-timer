'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import TimeCarousel from './TimeCarousel';
import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';
import { App } from '@capacitor/app';
import { usesNativeTeaSession } from '../lib/tea-session';
import {
  getBrewingProgress,
  getBrewingRemainingSeconds,
  getCoolingElapsedSeconds,
  getCoolingProgress,
} from '../lib/timer-time';

type TimerPhase = 'brewing' | 'cooling';


const TeaTimer: React.FC = () => {
  const { language, t } = useLanguage();
  const {
    completePour,
    completeCoolingAlert,
    continueSession,
    durationSeconds,
    isStaleSessionPromptOpen,
    setDurationSeconds,
    pourCount,
    registerSessionResetHandler,
    resetSession,
    setIsTeaCoolingTooLong,
    startTimer,
    stopTimer,
    timer,
  } = useTeaSession();
  const [now, setNow] = useState(Date.now);
  const [isResetPopupOpen, setIsResetPopupOpen] = useState(false);
  const progressCanvasRef = useRef<HTMLCanvasElement>(null);
  const resetPopupRef = useRef<HTMLDivElement>(null);
  const staleSessionDialogRef = useRef<HTMLDialogElement>(null);
  const resetInProgressRef = useRef(false);
  const progressValueRef = useRef(0);
  const progressPhaseRef = useRef<TimerPhase>('brewing');
  const mountedAt = useRef(now);

  const progressTimerId = timer?.id;
  const progressTimerPhase = timer?.phase;
  const progressEndAt = timer?.endAt;
  const progressDurationMs = (timer?.duration ?? 0) * 1000;
  const coolingDurationMs = timer?.phase === 'cooling' && timer.coolingAlertEnabled ? timer.coolingDurationMs : 0;
  const alertDeadline = timer?.phase === 'brewing' ? timer.endAt
    : timer?.phase === 'cooling' && coolingDurationMs > 0 && !timer.coolingAlertHandled
      ? timer.endAt + coolingDurationMs : undefined;
  const timeLeft = timer
    ? timer.phase === 'cooling'
      ? -getCoolingElapsedSeconds(now - timer.endAt)
      : getBrewingRemainingSeconds(timer.endAt - Math.max(now, timer.startedAt))
    : 0;
  const isBrewingActive = timer?.phase === 'brewing';
  const isTeaCoolingTooLong = coolingDurationMs > 0 && -timeLeft * 1000 >= coolingDurationMs;

  const getPourWord = (count: number) => {
    if (language === 'en') return t('pourMany');

    const lastTwoDigits = count % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return t('pourMany');

    const lastDigit = count % 10;
    if (lastDigit === 1) return t('pourOne');
    if (lastDigit >= 2 && lastDigit <= 4) return t('pourFew');
    return t('pourMany');
  };

  const getPourVerb = (count: number) =>
    language === 'en' || getPourWord(count) !== t('pourOne') ? t('madePlural') : t('made');

  const openResetPopup = useCallback(() => {
    resetInProgressRef.current = false;
    setIsResetPopupOpen(true);
  }, []);

  useEffect(() => {
    setIsTeaCoolingTooLong(isTeaCoolingTooLong);
  }, [isTeaCoolingTooLong, setIsTeaCoolingTooLong]);

  useEffect(() => {
    const dialog = staleSessionDialogRef.current;
    if (isStaleSessionPromptOpen && dialog && !dialog.open) dialog.showModal();
  }, [isStaleSessionPromptOpen]);

  useEffect(() => {
    if (!isResetPopupOpen) return;

    const closePopup = (restoreFocus = false) => {
      setIsResetPopupOpen(false);
      if (restoreFocus) document.getElementById('settings-menu-button')?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !resetPopupRef.current?.contains(target)
      ) {
        closePopup();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopup(true);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isResetPopupOpen]);

  useEffect(
    () => registerSessionResetHandler(openResetPopup),
    [openResetPopup, registerSessionResetHandler],
  );

  const setProgressBorderProgress = useCallback((progress: number, phase: TimerPhase) => {
    const canvas = progressCanvasRef.current;

    if (!canvas) return;

    const clampedProgress = Math.max(0, Math.min(1, progress));
    progressValueRef.current = clampedProgress;
    progressPhaseRef.current = phase;
    const isCooling = phase === 'cooling';
    canvas.classList.toggle(
      'active-timer-progress-ready',
      isCooling && clampedProgress >= 1,
    );

    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width;
    const height = bounds.height;
    if (width <= 0 || height <= 0) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) return;

    const inset = 1;
    const left = inset;
    const top = inset;
    const right = width - inset;
    const bottom = height - inset;
    const radius = Math.min(11, (right - left) / 2, (bottom - top) / 2);
    const perimeter =
      2 * (right - left - radius * 2) +
      2 * (bottom - top - radius * 2) +
      2 * Math.PI * radius;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (clampedProgress === 0) return;

    context.beginPath();
    context.moveTo(width / 2, top);
    if (isCooling) {
      context.lineTo(right - radius, top);
      context.arc(right - radius, top + radius, radius, -Math.PI / 2, 0);
      context.lineTo(right, bottom - radius);
      context.arc(right - radius, bottom - radius, radius, 0, Math.PI / 2);
      context.lineTo(left + radius, bottom);
      context.arc(left + radius, bottom - radius, radius, Math.PI / 2, Math.PI);
      context.lineTo(left, top + radius);
      context.arc(left + radius, top + radius, radius, Math.PI, (3 * Math.PI) / 2);
    } else {
      context.lineTo(left + radius, top);
      context.arc(left + radius, top + radius, radius, -Math.PI / 2, -Math.PI, true);
      context.lineTo(left, bottom - radius);
      context.arc(left + radius, bottom - radius, radius, Math.PI, Math.PI / 2, true);
      context.lineTo(right - radius, bottom);
      context.arc(right - radius, bottom - radius, radius, Math.PI / 2, 0, true);
      context.lineTo(right, top + radius);
      context.arc(right - radius, top + radius, radius, 0, -Math.PI / 2, true);
    }
    context.lineTo(width / 2, top);

    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const colorToken = isCooling ? '--color-text-primary' : '--color-brewing-progress';
    context.strokeStyle = getComputedStyle(canvas).getPropertyValue(colorToken).trim();
    context.setLineDash([perimeter * clampedProgress, perimeter]);
    context.lineDashOffset = 0;
    context.stroke();
    context.setLineDash([]);
  }, []);

  useEffect(() => {
    const canvas = progressCanvasRef.current;
    if (!canvas) return;

    const redraw = () => setProgressBorderProgress(progressValueRef.current, progressPhaseRef.current);
    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(canvas);
    window.addEventListener('tea-timer-color-theme-change', redraw);
    window.addEventListener('tea-timer-theme-change', redraw);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('tea-timer-color-theme-change', redraw);
      window.removeEventListener('tea-timer-theme-change', redraw);
    };
  }, [setProgressBorderProgress]);

  const syncTimerState = useCallback(() => {
    if (!progressTimerId || progressEndAt === undefined || !progressTimerPhase) return;

    const currentTime = Date.now();
    setNow(currentTime);
    if (progressTimerPhase === 'cooling') {
      if (coolingDurationMs === 0) return;
      const coolingEndsAt = progressEndAt + coolingDurationMs;
      if (currentTime >= coolingEndsAt) completeCoolingAlert(progressTimerId, mountedAt.current < coolingEndsAt);
      setProgressBorderProgress(getCoolingProgress(currentTime - progressEndAt, coolingDurationMs), 'cooling');
    } else if (currentTime >= progressEndAt) {
      completePour(progressTimerId, mountedAt.current < progressEndAt);
    }
  }, [completeCoolingAlert, completePour, coolingDurationMs, progressEndAt, progressTimerId, progressTimerPhase, setProgressBorderProgress]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncTimerState();
    };
    const timerInterval = window.setInterval(syncTimerState, 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', syncTimerState);
    const listener = usesNativeTeaSession() ? App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) syncTimerState();
    }) : undefined;

    return () => {
      window.clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', syncTimerState);
      void listener?.then((handle) => handle.remove()).catch(() => {});
    };
  }, [syncTimerState]);

  useEffect(() => {
    if (alertDeadline === undefined) return;
    let timeout: number | undefined;
    const checkDeadline = () => {
      const remaining = alertDeadline - Date.now();
      if (remaining > 0) timeout = window.setTimeout(checkDeadline, remaining);
      else syncTimerState();
    };
    checkDeadline();
    return () => window.clearTimeout(timeout);
  }, [alertDeadline, syncTimerState]);

  useEffect(() => {
    if (!progressTimerId || progressEndAt === undefined || !progressTimerPhase) {
      setProgressBorderProgress(0, 'brewing');
      return;
    }
    if (progressTimerPhase === 'cooling' && coolingDurationMs === 0) {
      setProgressBorderProgress(0, 'cooling');
      return;
    }

    let frame: number | undefined;
    const updateProgress = () => {
      const remainingMs = progressEndAt - Date.now();
      if (progressTimerPhase === 'cooling') {
        const progress = getCoolingProgress(-remainingMs, coolingDurationMs);
        setProgressBorderProgress(progress, 'cooling');
        if (progress < 1) frame = requestAnimationFrame(updateProgress);
      } else {
        const progress = getBrewingProgress(remainingMs, progressDurationMs);
        setProgressBorderProgress(progress, 'brewing');
        if (remainingMs > 0) frame = requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    return () => { if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [coolingDurationMs, progressDurationMs, progressEndAt, progressTimerId, progressTimerPhase, setProgressBorderProgress]);

  const formatTime = (time: number) => {
    const displayMinutes = Math.floor(time / 60);
    const displaySeconds = time % 60;

    return `${displayMinutes.toString().padStart(2, '0')}:${displaySeconds
      .toString()
      .padStart(2, '0')}`;
  };

  const isNegative = timeLeft < 0;
  const countdownDigits = formatTime(Math.abs(timeLeft));

  const handleConfirmSessionReset = () => {
    if (resetInProgressRef.current) return;
    resetInProgressRef.current = true;
    resetSession();
    setIsResetPopupOpen(false);
  };

  return (
    <section className="timer-stack flex w-full flex-col" aria-label={t('teaTimerControls')}>
      <div className="timer-primary-flow">
        <div
          className={`timer-setting transition-[opacity,transform] duration-300 motion-reduce:transition-none ${
            isBrewingActive ? 'scale-[0.96] opacity-55' : 'opacity-100'
          }`}
        >
          <TimeCarousel value={durationSeconds} onChange={setDurationSeconds} />
        </div>

        <div className="functional-block timer-actions grid w-full grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => timer && stopTimer(timer.id)}
            className="control-button control-button-secondary"
            disabled={!timer}
          >
            {t('stop')}
          </button>
          <button
            type="button"
            onClick={startTimer}
            className="control-button control-button-primary col-span-2"
            disabled={isBrewingActive || durationSeconds === 0}
          >
            {t('start')}
          </button>
        </div>

        <div className="functional-block active-timer-section">
          <span
            className="time-carousel-label active-timer-label"
            data-phase={timer?.phase ?? 'idle'}
            aria-live="polite"
          >
            {timer
              ? t(timer.phase === 'cooling' ? 'teaCoolingLabel' : 'teaBrewing')
              : t('noActiveTimers')}
          </span>
          <div
            className="active-timer"
            data-phase={timer?.phase ?? 'idle'}
          >
            <canvas ref={progressCanvasRef} className="active-timer-progress" aria-hidden="true" />
            <output
              className="active-timer-digits"
              data-negative={isNegative ? '' : undefined}
              aria-label={
                timer
                  ? `${isNegative ? '-' : ''}${countdownDigits} ${t(timer.phase === 'cooling' ? 'overtime' : 'remaining')}`
                  : t('noActiveTimers')
              }
            >
              {isNegative && <span className="active-timer-minus" aria-hidden="true">-</span>}
              {timer && countdownDigits}
            </output>
          </div>
        </div>
      </div>

      <div className="functional-block brew-counter-row">
        <p className="brew-counter" aria-live="polite" aria-atomic="true">
          <span className="brew-counter-content">
            <span>{getPourVerb(pourCount)}</span>
            <output className="brew-counter-value">
              {pourCount}
            </output>
            <span>{getPourWord(pourCount)}</span>
          </span>
        </p>
      </div>

      {isStaleSessionPromptOpen && (
        <dialog
          ref={staleSessionDialogRef}
          className="stale-session-dialog"
          aria-labelledby="stale-session-title"
          onCancel={(event) => {
            event.preventDefault();
            continueSession();
          }}
        >
          <h2 id="stale-session-title">{t('resetTitle')}</h2>
          <div className="session-reset-popup-actions">
            <button
              type="button"
              className="session-reset-popup-button session-reset-cancel"
              onClick={continueSession}
              autoFocus
            >
              {t('continueTeaSession')}
            </button>
            <button
              type="button"
              className="session-reset-popup-button control-button-primary"
              onClick={() => resetSession(true)}
            >
              {t('startNewTeaSession')}
            </button>
          </div>
        </dialog>
      )}

      {isResetPopupOpen && (
      <div
        id="session-reset-popup"
        ref={resetPopupRef}
        className="session-reset-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-reset-title"
        aria-describedby="session-reset-description"
      >
        <div className="session-reset-popup-content">
          <h2 id="session-reset-title">{t('resetTeaSessionTitle')}</h2>
          <p id="session-reset-description">
            {t('resetTeaSessionDescription')}
          </p>
          <div className="session-reset-popup-actions">
            <button
              type="button"
              className="session-reset-popup-button session-reset-cancel"
              onClick={() => {
                setIsResetPopupOpen(false);
                document.getElementById('settings-menu-button')?.focus();
              }}
              autoFocus
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className="session-reset-popup-button session-reset-confirm"
              onClick={handleConfirmSessionReset}
            >
              {t('reset')}
            </button>
          </div>
        </div>
      </div>
      )}
    </section>
  );
};

export default TeaTimer;
