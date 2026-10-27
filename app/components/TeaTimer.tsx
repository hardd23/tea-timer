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

interface CompletedTimer {
  id: string;
  label: string;
}

type TimerPhase = 'brewing' | 'cooling';

interface TimerInstance {
  id: string;
  initialTime: number;
  endAt: number;
  timeLeft: number;
  isRunning: boolean;
  timerPhase: TimerPhase;
  label: string;
}

const COOLING_DURATION_MS = 3 * 60 * 1000;
const BREWING_PROGRESS_COLOR = '#88d982';
const COOLING_PROGRESS_COLOR = '#72b7ff';

const TeaTimer: React.FC = () => {
  const { language, t } = useLanguage();
  const {
    adjustPourCount,
    pourCount,
    registerSessionResetHandler,
    resetPourCount,
    setIsTeaCoolingTooLong,
  } = useTeaSession();
  const [activeTimers, setActiveTimers] = useState<TimerInstance[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [currentDisplayTimerId, setCurrentDisplayTimerId] = useState<string | null>(null);
  const [isResetPopupOpen, setIsResetPopupOpen] = useState(false);
  const progressCanvasRef = useRef<HTMLCanvasElement>(null);
  const resetPopupRef = useRef<HTMLDivElement>(null);
  const resetInProgressRef = useRef(false);
  const progressValueRef = useRef(0);
  const progressColorRef = useRef(BREWING_PROGRESS_COLOR);
  const progressFrameRef = useRef<number | null>(null);
  const coolingStartedRef = useRef<Set<string>>(new Set());
  const completedTimerIdsRef = useRef<Set<string>>(new Set());

  const currentDisplayTimer = activeTimers.find(
    (timer) => timer.id === currentDisplayTimerId,
  );
  const hasActiveCountdown = Boolean(currentDisplayTimer?.isRunning);
  const isBrewingActive = currentDisplayTimer?.timerPhase === 'brewing';
  const progressTimerId = currentDisplayTimer?.id;
  const progressTimerPhase = currentDisplayTimer?.timerPhase;
  const progressTimerIsRunning = currentDisplayTimer?.isRunning;
  const progressEndAt = currentDisplayTimer?.endAt;
  const progressTimerLabel = currentDisplayTimer?.label;
  const progressDurationMs = (currentDisplayTimer?.initialTime ?? 0) * 1000;
  const isTeaCoolingTooLong = Boolean(
    currentDisplayTimer?.isRunning &&
      currentDisplayTimer.timerPhase === 'cooling' &&
      currentDisplayTimer.timeLeft < -180,
  );

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

  const setProgressBorderProgress = useCallback((progress: number, color: string) => {
    const canvas = progressCanvasRef.current;

    if (!canvas) return;

    const clampedProgress = Math.max(0, Math.min(1, progress));
    progressValueRef.current = clampedProgress;
    progressColorRef.current = color;
    canvas.classList.toggle(
      'active-timer-progress-ready',
      color === COOLING_PROGRESS_COLOR && clampedProgress >= 1,
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
    if (color === COOLING_PROGRESS_COLOR) {
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
    context.strokeStyle = color;
    context.setLineDash([perimeter * clampedProgress, perimeter]);
    context.lineDashOffset = 0;
    context.stroke();
    context.setLineDash([]);
  }, []);

  useEffect(() => {
    const canvas = progressCanvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      setProgressBorderProgress(progressValueRef.current, progressColorRef.current);
    });
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, [setProgressBorderProgress]);

  const recordCompletedTimer = useCallback((timer: CompletedTimer) => {
    if (completedTimerIdsRef.current.has(timer.id)) return;

    completedTimerIdsRef.current.add(timer.id);
    adjustPourCount(1);
  }, [adjustPourCount]);

  const startCooling = useCallback((timer: CompletedTimer, overtimeSeconds: number) => {
    const { id: timerId } = timer;

    if (coolingStartedRef.current.has(timerId)) return;

    coolingStartedRef.current.add(timerId);
    recordCompletedTimer(timer);
    setProgressBorderProgress(0, COOLING_PROGRESS_COLOR);

    setActiveTimers((prevTimers) =>
      prevTimers.map((activeTimer) =>
        activeTimer.id === timerId
          ? {
              ...activeTimer,
              timeLeft: overtimeSeconds > 0 ? -overtimeSeconds : 0,
              isRunning: true,
              timerPhase: 'cooling',
            }
          : activeTimer,
      ),
    );

    void new Audio('/notification.mp3').play().catch(() => undefined);
  }, [recordCompletedTimer, setProgressBorderProgress]);

  const syncTimerState = useCallback(() => {
    if (
      !progressTimerId ||
      !progressTimerLabel ||
      !progressTimerIsRunning ||
      progressEndAt === undefined ||
      progressDurationMs <= 0
    ) {
      return;
    }

    const remainingMs = progressEndAt - Date.now();

    if (progressTimerPhase === 'cooling') {
      const overtimeSeconds = Math.floor(Math.max(0, -remainingMs) / 1000);
      const coolingTimeLeft = overtimeSeconds > 0 ? -overtimeSeconds : 0;

      const coolingProgress = Math.min(1, Math.max(0, -remainingMs) / COOLING_DURATION_MS);
      setProgressBorderProgress(coolingProgress, COOLING_PROGRESS_COLOR);
      setActiveTimers((prevTimers) => {
        let didChange = false;
        const nextTimers = prevTimers.map((timer) => {
          if (timer.id !== progressTimerId || timer.timeLeft === coolingTimeLeft) {
            return timer;
          }

          didChange = true;
          return { ...timer, timeLeft: coolingTimeLeft };
        });

        return didChange ? nextTimers : prevTimers;
      });
      return;
    }

    const brewingRemainingMs = Math.max(0, remainingMs);
    const progress = Math.max(0, Math.min(1, brewingRemainingMs / progressDurationMs));

    setProgressBorderProgress(progress, BREWING_PROGRESS_COLOR);

    if (remainingMs <= 0) {
      const overtimeSeconds = Math.floor(Math.max(0, -remainingMs) / 1000);
      startCooling(
        { id: progressTimerId, label: progressTimerLabel },
        overtimeSeconds,
      );
      return;
    }

    const remainingSeconds = Math.ceil(brewingRemainingMs / 1000);
    setActiveTimers((prevTimers) => {
      let didChange = false;
      const nextTimers = prevTimers.map((timer) => {
        if (timer.id !== progressTimerId || timer.timeLeft === remainingSeconds) {
          return timer;
        }

        didChange = true;
        return { ...timer, timeLeft: remainingSeconds };
      });

      return didChange ? nextTimers : prevTimers;
    });
  }, [
    progressDurationMs,
    progressEndAt,
    progressTimerId,
    progressTimerIsRunning,
    progressTimerLabel,
    progressTimerPhase,
    setProgressBorderProgress,
    startCooling,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTimerState();
      }
    };
    const handlePageShow = () => syncTimerState();
    const timerInterval = window.setInterval(syncTimerState, 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [syncTimerState]);

  useEffect(() => {
    if (progressFrameRef.current !== null) {
      cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }

    if (
      !progressTimerId ||
      !progressTimerLabel ||
      (progressTimerPhase !== 'brewing' && progressTimerPhase !== 'cooling') ||
      !progressTimerIsRunning ||
      progressEndAt === undefined ||
      progressDurationMs <= 0
    ) {
      setProgressBorderProgress(0, BREWING_PROGRESS_COLOR);
      return;
    }

    const updateProgress = () => {
      const now = Date.now();

      if (progressTimerPhase === 'cooling') {
        const coolingProgress = Math.min(
          1,
          Math.max(0, now - progressEndAt) / COOLING_DURATION_MS,
        );
        setProgressBorderProgress(coolingProgress, COOLING_PROGRESS_COLOR);

        if (coolingProgress < 1) {
          progressFrameRef.current = requestAnimationFrame(updateProgress);
        } else {
          progressFrameRef.current = null;
        }
        return;
      }

      const remainingMs = Math.max(0, progressEndAt - now);
      const progress = Math.max(0, Math.min(1, remainingMs / progressDurationMs));
      setProgressBorderProgress(progress, BREWING_PROGRESS_COLOR);

      if (progress > 0) {
        progressFrameRef.current = requestAnimationFrame(updateProgress);
      } else {
        progressFrameRef.current = null;
        const overtimeSeconds = Math.floor(
          Math.max(0, Date.now() - progressEndAt) / 1000,
        );
        startCooling(
          { id: progressTimerId, label: progressTimerLabel },
          overtimeSeconds,
        );
      }
    };

    updateProgress();

    return () => {
      if (progressFrameRef.current !== null) {
        cancelAnimationFrame(progressFrameRef.current);
        progressFrameRef.current = null;
      }
    };
  }, [
    progressDurationMs,
    progressEndAt,
    progressTimerId,
    progressTimerIsRunning,
    progressTimerLabel,
    progressTimerPhase,
    setProgressBorderProgress,
    startCooling,
  ]);

  const formatTime = (time: number) => {
    const absTime = Math.abs(time);
    const displayMinutes = Math.floor(absTime / 60);
    const displaySeconds = absTime % 60;
    const sign = time < 0 ? '-' : '';

    return `${sign}${displayMinutes.toString().padStart(2, '0')}:${displaySeconds
      .toString()
      .padStart(2, '0')}`;
  };

  const handleStartTimer = () => {
    const totalSeconds = durationSeconds;

    if (totalSeconds <= 0) return;

    setProgressBorderProgress(1, BREWING_PROGRESS_COLOR);

    const newTimer: TimerInstance = {
      id: Date.now().toString(),
      initialTime: totalSeconds,
      endAt: Date.now() + totalSeconds * 1000,
      timeLeft: totalSeconds,
      isRunning: true,
      timerPhase: 'brewing',
      label: formatTime(durationSeconds),
    };

    coolingStartedRef.current.delete(newTimer.id);
    setActiveTimers((prevTimers) => [
      ...prevTimers.filter((timer) => timer.timerPhase !== 'cooling'),
      newTimer,
    ]);
    setCurrentDisplayTimerId(newTimer.id);
  };

  const handleResetTimer = (id: string) => {
    setActiveTimers((prevTimers) => {
      const remainingTimers = prevTimers.filter((timer) => timer.id !== id);

      if (id === currentDisplayTimerId) {
        setCurrentDisplayTimerId(remainingTimers.length > 0 ? remainingTimers[0].id : null);
      }

      return remainingTimers;
    });
  };

  const handleStopTimer = (timer: TimerInstance) => {
    coolingStartedRef.current.add(timer.id);
    if (progressFrameRef.current !== null) {
      cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }
    setProgressBorderProgress(0, BREWING_PROGRESS_COLOR);
    handleResetTimer(timer.id);
  };

  const handleConfirmSessionReset = () => {
    if (resetInProgressRef.current) return;

    resetInProgressRef.current = true;

    if (progressFrameRef.current !== null) {
      cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }

    coolingStartedRef.current.clear();
    completedTimerIdsRef.current.clear();
    setActiveTimers([]);
    resetPourCount();
    setDurationSeconds(10);
    setCurrentDisplayTimerId(null);
    setIsTeaCoolingTooLong(false);
    setProgressBorderProgress(0, BREWING_PROGRESS_COLOR);
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
            onClick={() => currentDisplayTimer && handleStopTimer(currentDisplayTimer)}
            className="control-button control-button-secondary"
            disabled={!currentDisplayTimer}
          >
            {t('stop')}
          </button>
          <button
            type="button"
            onClick={handleStartTimer}
            className="control-button control-button-primary col-span-2"
            disabled={isBrewingActive || durationSeconds === 0}
          >
            {t('start')}
          </button>
        </div>

        <div
          className="functional-block active-timer"
          data-phase={hasActiveCountdown ? currentDisplayTimer?.timerPhase : 'idle'}
        >
          <canvas ref={progressCanvasRef} className="active-timer-progress" aria-hidden="true" />
          <output
            className="active-timer-digits"
            aria-label={
              hasActiveCountdown && currentDisplayTimer
                ? currentDisplayTimer.timerPhase === 'cooling'
                  ? `${formatTime(currentDisplayTimer.timeLeft)} ${t('overtime')}`
                  : `${formatTime(currentDisplayTimer.timeLeft)} ${t('remaining')}`
                : t('noActiveTimers')
            }
          >
            {hasActiveCountdown && currentDisplayTimer
              ? formatTime(currentDisplayTimer.timeLeft)
              : t('noActiveTimers')}
          </output>
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
