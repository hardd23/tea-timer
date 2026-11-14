'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useDiary } from './DiaryContext';

type SecondsStep = 5 | 10;
const STEP_KEY = 'tea-timer-seconds-step';
const STEP_EVENT = 'tea-timer-seconds-step-change';
let fallbackStep: SecondsStep = 10;
let useFallbackStep = false;
const getStep = (): SecondsStep => {
  if (useFallbackStep) return fallbackStep;
  try { return window.localStorage.getItem(STEP_KEY) === '5' ? 5 : 10; }
  catch { return fallbackStep; }
};
const subscribeStep = (notify: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STEP_KEY && event.key !== null) return;
    useFallbackStep = false;
    notify();
  };
  window.addEventListener(STEP_EVENT, notify);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(STEP_EVENT, notify); window.removeEventListener('storage', onStorage); };
};

interface TeaSessionContextValue {
  secondsStep: SecondsStep;
  setSecondsStep: (step: SecondsStep) => void;
  durationSeconds: number;
  setDurationSeconds: Dispatch<SetStateAction<number>>;
  isTeaCoolingTooLong: boolean;
  setIsTeaCoolingTooLong: Dispatch<SetStateAction<boolean>>;
  pourCount: number;
  adjustPourCount: (amount: number) => void;
  completePour: (timerId: string, at: number) => void;
  resetPourCount: () => void;
  registerSessionResetHandler: (handler: () => void) => () => void;
  requestSessionReset: () => void;
}

const TeaSessionContext = createContext<TeaSessionContextValue | null>(null);

export function TeaSessionProvider({ children }: { children: ReactNode }) {
  const diary = useDiary();
  const recordDiary = diary?.record;
  const [isTeaCoolingTooLong, setIsTeaCoolingTooLong] = useState(false);
  const [pourCount, setPourCount] = useState(0);
  const pourCountRef = useRef(0);
  const lastDiaryActiveRef = useRef<string | null | undefined>(undefined);
  const [durationSeconds, setDurationSeconds] = useState(10);
  const secondsStep = useSyncExternalStore<SecondsStep>(subscribeStep, getStep, () => 10);
  const setSecondsStep = useCallback((step: SecondsStep) => {
    fallbackStep = step;
    try { window.localStorage.setItem(STEP_KEY, String(step)); useFallbackStep = false; }
    catch { useFallbackStep = true; }
    setDurationSeconds((duration) => duration - (duration % step));
    window.dispatchEvent(new Event(STEP_EVENT));
  }, []);
  useEffect(() => {
    const syncDuration = (event: StorageEvent) => {
      if (event.key !== STEP_KEY && event.key !== null) return;
      useFallbackStep = false;
      const step = getStep();
      setDurationSeconds((duration) => duration - (duration % step));
    };
    window.addEventListener('storage', syncDuration);
    return () => window.removeEventListener('storage', syncDuration);
  }, []);
  const sessionResetHandlerRef = useRef<(() => void) | null>(null);

  const adjustPourCount = useCallback((amount: number) => {
    const next = Math.min(99, Math.max(0, pourCountRef.current + amount));
    if (next === pourCountRef.current) return;
    pourCountRef.current = next;
    setPourCount(next);
    recordDiary?.({ type: 'adjust', amount });
  }, [recordDiary]);

  const completePour = useCallback((timerId: string, at: number) => {
    const next = Math.min(99, pourCountRef.current + 1);
    pourCountRef.current = next;
    setPourCount(next);
    recordDiary?.({ type: 'complete', timerId, at });
  }, [recordDiary]);

  const resetPourCount = useCallback(() => { pourCountRef.current = 0; setPourCount(0); }, []);

  useEffect(() => {
    if (!diary?.ready || diary.error) return;
    const active = diary.state.sessions.find((session) => session.id === diary.state.activeId);
    if (active || (lastDiaryActiveRef.current !== undefined && lastDiaryActiveRef.current !== diary.state.activeId)) {
      const next = active?.count ?? 0;
      pourCountRef.current = next;
      setPourCount(next);
    }
    lastDiaryActiveRef.current = diary.state.activeId;
  }, [diary?.state, diary?.ready, diary?.error]);

  const registerSessionResetHandler = useCallback((handler: () => void) => {
    sessionResetHandlerRef.current = handler;

    return () => {
      if (sessionResetHandlerRef.current === handler) {
        sessionResetHandlerRef.current = null;
      }
    };
  }, []);

  const requestSessionReset = useCallback(() => {
    sessionResetHandlerRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      isTeaCoolingTooLong,
      setIsTeaCoolingTooLong,
      secondsStep,
      setSecondsStep,
      durationSeconds,
      setDurationSeconds,
      pourCount,
      adjustPourCount,
      completePour,
      resetPourCount,
      registerSessionResetHandler,
      requestSessionReset,
    }),
    [
      adjustPourCount,
      completePour,
      durationSeconds,
      secondsStep,
      setSecondsStep,
      isTeaCoolingTooLong,
      pourCount,
      registerSessionResetHandler,
      requestSessionReset,
      resetPourCount,
    ],
  );

  return (
    <TeaSessionContext.Provider value={value}>
      {children}
    </TeaSessionContext.Provider>
  );
}

export function useTeaSession() {
  const context = useContext(TeaSessionContext);

  if (!context) {
    throw new Error('useTeaSession must be used within TeaSessionProvider');
  }

  return context;
}
