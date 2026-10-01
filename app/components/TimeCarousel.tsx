'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react';

interface TimeCarouselProps {
  value: number;
  onChange: (value: number) => void;
}

interface MouseDragState {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  didMove: boolean;
}

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}\u2033`;
  return `${minutes}\u2032${String(seconds).padStart(2, '0')}\u2033`;
};

const ITEM_WIDTH = 104;
const createRange = (start: number, end: number, step: number) =>
  Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, index) => start + index * step);
const TIME_VALUES = [
  ...createRange(10, 50, 10),
  ...createRange(60, 4 * 60 + 30, 30),
  ...createRange(5 * 60, 10 * 60, 60),
  ...createRange(15 * 60, 55 * 60, 5 * 60),
];

const getAccessibleDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (minutes > 0) parts.push(`${minutes} мин.`);
  if (seconds > 0) parts.push(`${seconds} сек.`);
  return parts.join(' ');
};

export default function TimeCarousel({ value, onChange }: TimeCarouselProps) {
  const values = TIME_VALUES;
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const initialValueRef = useRef(value);
  const selectedRef = useRef(value);
  const animationFrameRef = useRef<number | null>(null);
  const wheelTimeoutRef = useRef<number | null>(null);
  const scrollEndTimeoutRef = useRef<number | null>(null);
  const mouseDragRef = useRef<MouseDragState | null>(null);
  const suppressClickRef = useRef(false);
  const [selectedValue, setSelectedValue] = useState(value);

  const scrollToValue = useCallback((nextValue: number, behavior: ScrollBehavior) => {
    const viewport = viewportRef.current;
    const item = itemRefs.current.get(nextValue);
    if (!viewport || !item) return;

    const viewportBounds = viewport.getBoundingClientRect();
    const itemBounds = item.getBoundingClientRect();
    const left =
      viewport.scrollLeft +
      itemBounds.left +
      itemBounds.width / 2 -
      (viewportBounds.left + viewportBounds.width / 2);
    viewport.scrollTo({ left, behavior });
  }, []);

  useEffect(() => {
    const resetToInitial = () => {
      selectedRef.current = initialValueRef.current;
      setSelectedValue(initialValueRef.current);
      onChange(initialValueRef.current);
      scrollToValue(initialValueRef.current, 'auto');
    };

    resetToInitial();

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        resetToInitial();
      });
    });
    const restorationTimeout = window.setTimeout(resetToInitial, 120);

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(restorationTimeout);
    };
  }, [onChange, scrollToValue]);

  useEffect(() => {
    if (value === selectedRef.current) return;

    selectedRef.current = value;
    setSelectedValue(value);
    scrollToValue(value, 'smooth');
  }, [scrollToValue, value]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (wheelTimeoutRef.current !== null) {
        window.clearTimeout(wheelTimeoutRef.current);
      }
      if (scrollEndTimeoutRef.current !== null) {
        window.clearTimeout(scrollEndTimeoutRef.current);
      }
    },
    [],
  );

  const selectClosestItem = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const closestIndex = Math.max(
      0,
      Math.min(values.length - 1, Math.round(viewport.scrollLeft / ITEM_WIDTH)),
    );
    const closestValue = values[closestIndex];

    if (closestValue !== selectedRef.current) {
      selectedRef.current = closestValue;
      setSelectedValue(closestValue);
      onChange(closestValue);
    }
  }, [onChange, values]);

  const handleScroll = () => {
    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      selectClosestItem();
    });

    if (scrollEndTimeoutRef.current !== null) {
      window.clearTimeout(scrollEndTimeoutRef.current);
    }
    scrollEndTimeoutRef.current = window.setTimeout(() => {
      scrollEndTimeoutRef.current = null;
      snapToClosest();
    }, 120);
  };

  const moveSelection = (direction: number) => {
    const currentIndex = values.indexOf(selectedRef.current);
    const nextIndex = Math.max(0, Math.min(values.length - 1, currentIndex + direction));
    scrollToValue(values[nextIndex], 'smooth');
  };

  const snapToClosest = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const closestIndex = Math.max(
      0,
      Math.min(values.length - 1, Math.round(viewport.scrollLeft / ITEM_WIDTH)),
    );
    scrollToValue(values[closestIndex], 'smooth');
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add('is-dragging');
    suppressClickRef.current = false;
    mouseDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      didMove: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = mouseDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const distance = drag.startX - event.clientX;
    if (Math.abs(distance) > 4) {
      drag.didMove = true;
      suppressClickRef.current = true;
    }
    event.currentTarget.scrollLeft = drag.startScrollLeft + distance;
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = mouseDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.currentTarget.classList.remove('is-dragging');
    mouseDragRef.current = null;
    snapToClosest();
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    event.currentTarget.scrollLeft += delta;

    if (wheelTimeoutRef.current !== null) {
      window.clearTimeout(wheelTimeoutRef.current);
    }
    wheelTimeoutRef.current = window.setTimeout(() => {
      wheelTimeoutRef.current = null;
      snapToClosest();
    }, 100);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? -1
        : 0;

    if (direction !== 0) {
      event.preventDefault();
      moveSelection(direction);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      scrollToValue(event.key === 'Home' ? values[0] : values[values.length - 1], 'smooth');
    }
  };

  return (
    <div className="time-carousel-shell">
      <span className="time-carousel-label">Время заваривания</span>
      <div
        ref={viewportRef}
        className="time-carousel"
        role="listbox"
        aria-label="Время заваривания"
        aria-activedescendant={`time-option-${selectedValue}`}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onWheel={handleWheel}
      >
        {values.map((itemValue) => {
          const isSelected = itemValue === selectedValue;

          return (
            <button
              key={itemValue}
              ref={(node) => {
                if (node) itemRefs.current.set(itemValue, node);
                else itemRefs.current.delete(itemValue);
              }}
              id={`time-option-${itemValue}`}
              type="button"
              className={`time-carousel-option${isSelected ? ' is-selected' : ''}`}
              role="option"
              aria-label={getAccessibleDuration(itemValue)}
              aria-selected={isSelected}
              tabIndex={-1}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                scrollToValue(itemValue, 'smooth');
              }}
            >
              <span className={itemValue >= 60 ? 'has-minutes' : undefined}>
                {formatDuration(itemValue)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

