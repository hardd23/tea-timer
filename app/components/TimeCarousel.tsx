'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';

interface TimeCarouselProps {
  value: number;
  onChange: (value: number) => void;
}

interface TimeWheelProps {
  ariaLabel: string;
  max: number;
  step: number;
  unit: '\u2032' | '\u2033';
  value: number;
  onStep: (direction: 1 | -1) => void;
  onSet: (value: number) => void;
}

interface PointerDragState {
  pointerId: number;
  lastY: number;
  distance: number;
  stepDistance: number;
}

const INPUT_STEP_RATIO = 0.4;
const MIN_INPUT_STEP_PX = 48;
const WHEEL_LINE_PX = 20;
const WHEEL_IDLE_RESET_MS = 180;

const getInputStepDistance = (height: number) =>
  Math.max(MIN_INPUT_STEP_PX, height * INPUT_STEP_RATIO);

const padTimePart = (value: number) => value.toString().padStart(2, '0');

function TimeWheel({
  ariaLabel,
  max,
  step,
  unit,
  value,
  onStep,
  onSet,
}: TimeWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const wheelDistanceRef = useRef(0);
  const wheelResetRef = useRef<number | null>(null);
  const reelRef = useRef<HTMLSpanElement>(null);
  const reelStateRef = useRef<{ value: number; index: number; animation: Animation | null } | null>(null);

  useLayoutEffect(() => {
    const reel = reelRef.current;
    if (!reel) return;

    const state = reelStateRef.current;
    const addNumber = (number: number, index: number, spacing: number) => {
      const existing = reel.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (existing) {
        existing.textContent = padTimePart(number);
        existing.style.top = `calc(50% + ${index * spacing}px)`;
        return;
      }
      const item = document.createElement('span');
      item.className = 'time-wheel-number';
      item.dataset.index = String(index);
      item.textContent = padTimePart(number);
      item.style.top = `calc(50% + ${index * spacing}px)`;
      reel.appendChild(item);
    };
    const reset = () => {
      reel.replaceChildren();
      reel.style.transform = 'translateY(0px)';
      addNumber(value, 0, 0);
      reelStateRef.current = { value, index: 0, animation: null };
    };

    if (!state) {
      reset();
      return;
    }
    if (value === state.value) return;

    const range = max + step;
    const forward = (value - state.value + range) % range;
    const backward = (state.value - value + range) % range;
    const spacing = (wheelRef.current?.clientHeight ?? 0) * 0.7;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if ((forward !== step && backward !== step) || !spacing || reducedMotion || typeof reel.animate !== 'function' || Math.abs(state.index) > 20) {
      state.animation?.cancel();
      reset();
      return;
    }

    const currentTransform = getComputedStyle(reel).transform;
    const currentOffset = currentTransform === 'none' ? 0 : new DOMMatrixReadOnly(currentTransform).m42;
    state.animation?.cancel();
    const nextIndex = state.index + (forward === step ? 1 : -1);
    const targetOffset = -nextIndex * spacing;
    addNumber(value, nextIndex, spacing);
    reel.style.transform = `translateY(${targetOffset}px)`;
    const animation = reel.animate(
      [{ transform: `translateY(${currentOffset}px)` }, { transform: `translateY(${targetOffset}px)` }],
      { duration: 280, easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)' },
    );
    reelStateRef.current = { value, index: nextIndex, animation };
    animation.onfinish = () => {
      if (reelStateRef.current?.animation === animation) reset();
    };
  }, [max, step, value]);

  useEffect(() => () => reelStateRef.current?.animation?.cancel(), []);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;

      event.preventDefault();
      event.stopPropagation();

      const stepDistance = getInputStepDistance(wheel.clientHeight);
      const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? WHEEL_LINE_PX
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? wheel.clientHeight
          : 1;
      const normalizedDelta = Math.sign(event.deltaY)
        * Math.min(Math.abs(event.deltaY * multiplier), stepDistance);

      if (
        wheelDistanceRef.current !== 0
        && Math.sign(wheelDistanceRef.current) !== Math.sign(normalizedDelta)
      ) {
        wheelDistanceRef.current = 0;
      }

      wheelDistanceRef.current += normalizedDelta;

      if (Math.abs(wheelDistanceRef.current) >= stepDistance) {
        onStep(wheelDistanceRef.current > 0 ? 1 : -1);
        wheelDistanceRef.current = 0;
      }

      if (wheelResetRef.current !== null) {
        window.clearTimeout(wheelResetRef.current);
      }
      wheelResetRef.current = window.setTimeout(() => {
        wheelDistanceRef.current = 0;
        wheelResetRef.current = null;
      }, WHEEL_IDLE_RESET_MS);
    };

    wheel.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      wheel.removeEventListener('wheel', handleWheel);
      if (wheelResetRef.current !== null) {
        window.clearTimeout(wheelResetRef.current);
      }
    };
  }, [onStep]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = {
      pointerId: event.pointerId,
      lastY: event.clientY,
      distance: 0,
      stepDistance: getInputStepDistance(event.currentTarget.clientHeight),
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    const movement = drag.lastY - event.clientY;
    drag.lastY = event.clientY;
    drag.distance += movement;

    while (Math.abs(drag.distance) >= drag.stepDistance) {
      const direction = drag.distance > 0 ? 1 : -1;
      onStep(direction);
      drag.distance -= direction * drag.stepDistance;
    }
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerDragRef.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === 'ArrowUp' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -1
        : 0;

    if (direction !== 0) {
      event.preventDefault();
      onStep(direction);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      onSet(event.key === 'Home' ? 0 : max);
    }
  };

  return (
    <div
      ref={wheelRef}
      className="time-wheel"
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${padTimePart(value)} ${ariaLabel}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
    >
      <span className="time-wheel-value" aria-hidden="true">
        <span className="time-wheel-window"><span className="time-wheel-reel" ref={reelRef} /></span>
        <span className="time-wheel-unit">{unit}</span>
      </span>
    </div>
  );
}

export default function TimeCarousel({ value, onChange }: TimeCarouselProps) {
  const { t } = useLanguage();
  const { secondsStep } = useTeaSession();
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const commitValue = useCallback((minutes: number, seconds: number) => {
    const nextValue = minutes * 60 + seconds;
    valueRef.current = nextValue;
    onChange(nextValue);
  }, [onChange]);

  const stepMinutes = useCallback((direction: 1 | -1) => {
    const currentMinutes = Math.floor(valueRef.current / 60);
    const currentSeconds = valueRef.current % 60;
    commitValue((currentMinutes + direction + 60) % 60, currentSeconds);
  }, [commitValue]);

  const stepSeconds = useCallback((direction: 1 | -1) => {
    const currentMinutes = Math.floor(valueRef.current / 60);
    const currentSeconds = valueRef.current % 60;
    const nextSeconds = (currentSeconds + direction * secondsStep + 60) % 60;
    const crossesMinute = direction === 1 ? nextSeconds < currentSeconds : nextSeconds > currentSeconds;
    const nextMinutes = (currentMinutes + (crossesMinute ? direction : 0) + 60) % 60;
    commitValue(nextMinutes, nextSeconds);
  }, [commitValue, secondsStep]);

  const setMinutes = useCallback((minutes: number) => {
    commitValue(minutes, valueRef.current % 60);
  }, [commitValue]);

  const setSeconds = useCallback((seconds: number) => {
    commitValue(Math.floor(valueRef.current / 60), seconds);
  }, [commitValue]);

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return (
    <div className="time-carousel-shell">
      <span id="brew-time-label" className="time-carousel-label">{t('brewTime')}</span>
      <div className="time-wheel-picker" role="group" aria-labelledby="brew-time-label">
        <TimeWheel
          ariaLabel={t('minutes')}
          max={59}
          step={1}
          unit={'\u2032'}
          value={minutes}
          onStep={stepMinutes}
          onSet={setMinutes}
        />
        <TimeWheel
          ariaLabel={t('seconds')}
          max={60 - secondsStep}
          step={secondsStep}
          unit={'\u2033'}
          value={seconds}
          onStep={stepSeconds}
          onSet={setSeconds}
        />
      </div>
    </div>
  );
}
