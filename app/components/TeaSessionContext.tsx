'use client';

import { App } from '@capacitor/app';
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useDiary } from './DiaryContext';
import {
  clampPourCount, DEFAULT_COOLING_MINUTES, emptyTeaSession, MINUTE_MS, playTimerSignal,
  readNativeTeaSession, readWebTeaSession, requestNativeTimerAlerts, sessionId,
  SESSION_TIMEOUT_MS, TEA_SESSION_KEY, usesNativeTeaSession, writeNativeTeaSession, writeWebTeaSession,
  type CoolingDurationMinutes, type SavedTeaSession, type SavedTimer, type SessionDiaryEvent,
} from '../lib/tea-session';
import { prepareTimerSounds, stopTimerAudio, unlockTimerAudio, type TimerSoundId, type TimerSounds } from '../lib/timer-sounds';

const defaultSounds: TimerSounds = { brewing: 'default', cooling: 'default' };

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
  coolingEnabled: boolean;
  setCoolingEnabled: (enabled: boolean) => void;
  coolingDurationMinutes: CoolingDurationMinutes;
  adjustCoolingDuration: (change: -1 | 1) => void;
  isTeaCoolingTooLong: boolean;
  setIsTeaCoolingTooLong: Dispatch<SetStateAction<boolean>>;
  pourCount: number;
  adjustPourCount: (amount: number) => void;
  timer: SavedTimer | null;
  sounds: TimerSounds;
  setSound: (phase: SavedTimer['phase'], sound: TimerSoundId) => void;
  startTimer: () => void;
  completePour: (timerId: string, playSound: boolean) => void;
  completeCoolingAlert: (timerId: string, playSound: boolean) => void;
  stopTimer: (timerId: string) => void;
  resetSession: (preserveDuration?: boolean) => void;
  isStaleSessionPromptOpen: boolean;
  continueSession: () => void;
  registerSessionResetHandler: (handler: () => void) => () => void;
  requestSessionReset: () => void;
}

const TeaSessionContext = createContext<TeaSessionContextValue | null>(null);

const subscribeClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function TeaSessionProvider({ children }: { children: ReactNode }) {
  const diary = useDiary();
  const syncDiary = diary?.syncSessionEvents;
  const native = usesNativeTeaSession();
  const client = useSyncExternalStore(subscribeClient, clientSnapshot, serverSnapshot);
  const [snapshot, setSnapshot] = useState<SavedTeaSession | null | undefined>(
    () => typeof window === 'undefined' || native ? undefined : readWebTeaSession(),
  );
  const current = useRef(snapshot);
  const lastSaved = useRef(snapshot);
  const [isTeaCoolingTooLong, setIsTeaCoolingTooLong] = useState(false);
  const secondsStep = useSyncExternalStore<SecondsStep>(subscribeStep, getStep, () => 10);
  const sessionResetHandlerRef = useRef<(() => void) | null>(null);
  const [staleSession, setStaleSession] = useState<{ id: string; completedAt: number } | null>(null);
  const continuedSession = useRef(false);
  const restored = snapshot !== undefined;
  const sounds = snapshot?.sounds ?? defaultSounds;

  useEffect(() => {
    if (!native) prepareTimerSounds('default', sounds.brewing, sounds.cooling);
  }, [native, sounds.brewing, sounds.cooling]);

  useEffect(() => {
    if (!native) return stopTimerAudio;
  }, [native]);

  useEffect(() => {
    if (!restored) return;

    const checkSession = () => {
      const saved = current.current;
      if (continuedSession.current || !saved?.sessionId || saved.timer || saved.lastPourCompletedAt === undefined) return;
      if (Date.now() - saved.lastPourCompletedAt >= SESSION_TIMEOUT_MS) {
        setStaleSession({ id: saved.sessionId, completedAt: saved.lastPourCompletedAt });
      }
    };
    const checkVisibleSession = () => {
      if (document.visibilityState === 'visible') checkSession();
    };
    checkVisibleSession();
    document.addEventListener('visibilitychange', checkVisibleSession);
    window.addEventListener('pageshow', checkVisibleSession);
    const listener = native ? App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) checkSession();
    }) : undefined;

    return () => {
      document.removeEventListener('visibilitychange', checkVisibleSession);
      window.removeEventListener('pageshow', checkVisibleSession);
      void listener?.then((handle) => handle.remove()).catch(() => {});
    };
  }, [native, restored]);

  const continueSession = useCallback(() => {
    continuedSession.current = true;
    setStaleSession(null);
  }, []);

  useEffect(() => {
    if (!native) return;

    let live = true;
    void readNativeTeaSession().then((saved) => {
      if (!live) return;
      current.current = saved;
      lastSaved.current = saved;
      setSnapshot(saved);
    }).catch((error: unknown) => { console.error('Tea session could not be restored', error); });
    return () => { live = false; };
  }, [native]);

  const save = useCallback((next: SavedTeaSession) => {
    current.current = next;
    if (!native) {
      try { writeWebTeaSession(next); }
      catch (error) { console.error('Tea session could not be saved', error); }
      setSnapshot(next);
      return;
    }

    // Capacitor dispatches plugin methods in order; publish only after the disk commit.
    void writeNativeTeaSession(next).then(() => {
      lastSaved.current = next;
      if (current.current === next) setSnapshot(next);
    }).catch((error: unknown) => {
      if (current.current === next) {
        current.current = lastSaved.current;
        setSnapshot(lastSaved.current);
      }
      console.error('Tea session could not be saved', error);
    });
  }, [native]);

  useEffect(() => {
    if (native) return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== TEA_SESSION_KEY && event.key !== null) return;
      const saved = readWebTeaSession();
      current.current = saved;
      setSnapshot(saved);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [native]);

  const legacy = diary?.ready && !diary.error
    ? diary.state.sessions.find((session) => session.id === diary.state.activeId)
    : undefined;
  const legacyId = legacy?.id ?? null;
  const legacyCount = legacy?.count ?? 0;
  const getCurrent = useCallback((): SavedTeaSession => current.current ?? {
    ...emptyTeaSession(), sessionId: legacyId, pourCount: legacyCount,
  }, [legacyId, legacyCount]);
  const addDiaryEvent = useCallback((session: SavedTeaSession, event: SessionDiaryEvent): SavedTeaSession => (
    syncDiary ? { ...session, pendingDiary: [...session.pendingDiary, event] } : session
  ), [syncDiary]);

  const pendingDiary = snapshot?.pendingDiary;
  useEffect(() => {
    if (!syncDiary || !pendingDiary?.length) return;

    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const publish = async () => {
      try {
        await syncDiary(pendingDiary);
        if (!live) return;
        const latest = getCurrent();
        const applied = new Set(pendingDiary.map((event) => event.id));
        const remaining = latest.pendingDiary.filter((event) => !applied.has(event.id));
        if (remaining.length !== latest.pendingDiary.length) save({ ...latest, pendingDiary: remaining });
      } catch {
        if (live) retry = setTimeout(() => void publish(), 5000);
      }
    };
    void publish();
    return () => { live = false; clearTimeout(retry); };
  }, [getCurrent, pendingDiary, save, syncDiary]);

  const setDurationSeconds = useCallback<Dispatch<SetStateAction<number>>>((value) => {
    const state = getCurrent();
    const duration = typeof value === 'function' ? value(state.durationSeconds) : value;
    if (duration !== state.durationSeconds) save({ ...state, durationSeconds: duration });
  }, [getCurrent, save]);

  const setSound = useCallback((phase: SavedTimer['phase'], sound: TimerSoundId) => {
    const state = getCurrent();
    const sounds = state.sounds ?? defaultSounds;
    if (sounds[phase] !== sound) save({ ...state, sounds: { ...sounds, [phase]: sound } });
  }, [getCurrent, save]);

  const setSecondsStep = useCallback((step: SecondsStep) => {
    fallbackStep = step;
    try { window.localStorage.setItem(STEP_KEY, String(step)); useFallbackStep = false; }
    catch { useFallbackStep = true; }
    setDurationSeconds((duration) => duration - (duration % step));
    window.dispatchEvent(new Event(STEP_EVENT));
  }, [setDurationSeconds]);

  useEffect(() => {
    const syncDuration = (event: StorageEvent) => {
      if (event.key !== STEP_KEY && event.key !== null) return;
      if (native && current.current === undefined) return;
      useFallbackStep = false;
      const step = getStep();
      setDurationSeconds((duration) => duration - (duration % step));
    };
    window.addEventListener('storage', syncDuration);
    return () => window.removeEventListener('storage', syncDuration);
  }, [native, setDurationSeconds]);

  const coolIfDue = useCallback((state: SavedTeaSession, at: number): SavedTeaSession => {
    const timer = state.timer;
    if (!state.sessionId || timer?.phase !== 'brewing' || at < timer.endAt) return state;
    const pourNumber = clampPourCount(state.pourCount + 1);
    return addDiaryEvent({
      ...state,
      timer: {
        ...timer,
        phase: 'cooling',
        coolingDurationMs: state.coolingDurationMinutes * MINUTE_MS,
        coolingAlertEnabled: state.coolingEnabled,
        coolingAlertHandled: false,
        pourNumber,
      },
      pourCount: pourNumber,
      lastPourCompletedAt: timer.endAt,
    }, { type: 'complete', id: `complete:${timer.id}`, timerId: timer.id, sessionId: state.sessionId, at: timer.endAt });
  }, [addDiaryEvent]);

  const saveTimerEvent = useCallback((next: SavedTeaSession, timerId: string, phase: SavedTimer['phase'], sound: boolean) => {
    // Android claims the event against the current snapshot before replacing it.
    if (sound) playTimerSignal(timerId, phase, native, (next.sounds ?? defaultSounds)[phase]);
    save(next);
  }, [native, save]);

  const completePour = useCallback((timerId: string, playSound: boolean) => {
    const state = getCurrent();
    if (state.timer?.id !== timerId) return;
    const at = Date.now();
    const next = coolIfDue(state, at);
    if (next === state) return;
    const signal = playSound && (next.timer?.phase !== 'cooling' || !next.timer.coolingAlertEnabled
      || at < next.timer.endAt + next.timer.coolingDurationMs);
    saveTimerEvent(next, timerId, 'brewing', signal);
  }, [coolIfDue, getCurrent, saveTimerEvent]);

  const completeCoolingAlert = useCallback((timerId: string, playSound: boolean) => {
    const state = getCurrent();
    const timer = state.timer;
    if (timer?.id !== timerId || timer.phase !== 'cooling' || !timer.coolingAlertEnabled || timer.coolingAlertHandled ||
      Date.now() < timer.endAt + timer.coolingDurationMs) return;
    saveTimerEvent({ ...state, timer: { ...timer, coolingAlertHandled: true } }, timerId, 'cooling', playSound);
  }, [getCurrent, saveTimerEvent]);

  const setCoolingEnabled = useCallback((enabled: boolean) => {
    const state = getCurrent();
    if (state.coolingEnabled === enabled) return;
    const timer = !enabled && state.timer?.phase === 'cooling'
      ? { ...state.timer, coolingAlertEnabled: false }
      : state.timer;
    save({ ...state, coolingEnabled: enabled, timer });
  }, [getCurrent, save]);

  const adjustCoolingDuration = useCallback((change: -1 | 1) => {
    const state = getCurrent();
    const minutes = state.coolingDurationMinutes + change;
    if (minutes >= 1 && minutes <= 5) save({ ...state, coolingDurationMinutes: minutes as CoolingDurationMinutes });
  }, [getCurrent, save]);

  const startTimer = useCallback(() => {
    const state = getCurrent();
    if (state.durationSeconds <= 0 || state.timer?.phase === 'brewing') return;
    if (!native) unlockTimerAudio();

    const at = Date.now();
    const id = state.sessionId ?? sessionId();
    const timer: SavedTimer = {
      id: sessionId(), duration: state.durationSeconds, startedAt: at,
      endAt: at + state.durationSeconds * 1000, phase: 'brewing',
    };
    save(addDiaryEvent({ ...state, sessionId: id, timer }, {
      type: 'start', id: `start:${timer.id}`, at, sessionId: id, timerId: timer.id, duration: timer.duration,
    }));
    if (native) void requestNativeTimerAlerts().catch(() => {});
  }, [addDiaryEvent, getCurrent, native, save]);

  const stopTimer = useCallback((timerId: string) => {
    const state = getCurrent();
    if (!state.sessionId || state.timer?.id !== timerId) return;

    const at = Date.now();
    const next = coolIfDue(state, at);
    save(addDiaryEvent({ ...next, timer: null }, {
      type: 'stop', id: `stop:${timerId}`, at, sessionId: state.sessionId, timerId,
    }));
  }, [addDiaryEvent, coolIfDue, getCurrent, save]);

  const adjustPourCount = useCallback((amount: number) => {
    const state = getCurrent();
    const at = Date.now();
    const latest = coolIfDue(state, at);
    const count = clampPourCount(latest.pourCount + amount);
    if (count === latest.pourCount) {
      if (latest !== state) save(latest);
      return;
    }

    const id = latest.sessionId ?? sessionId();
    save(addDiaryEvent({ ...latest, sessionId: id, pourCount: count }, {
      type: 'adjust', id: sessionId(), at, sessionId: id, amount,
    }));
  }, [addDiaryEvent, coolIfDue, getCurrent, save]);

  const resetSession = useCallback((preserveDuration = false) => {
    const state = getCurrent();
    if (preserveDuration && (!state.sessionId || state.timer)) return;
    const at = Date.now();
    const latest = coolIfDue(state, at);
    const clean = {
      ...emptyTeaSession(),
      ...(preserveDuration ? { durationSeconds: latest.durationSeconds } : {}),
      coolingEnabled: latest.coolingEnabled,
      coolingDurationMinutes: latest.coolingDurationMinutes,
      sounds: latest.sounds,
      pendingDiary: latest.pendingDiary,
    };
    save(latest.sessionId ? addDiaryEvent(clean, {
      type: 'reset', id: sessionId(), at, sessionId: latest.sessionId,
    }) : clean);
  }, [addDiaryEvent, coolIfDue, getCurrent, save]);

  const registerSessionResetHandler = useCallback((handler: () => void) => {
    sessionResetHandlerRef.current = handler;

    return () => {
      if (sessionResetHandlerRef.current === handler) sessionResetHandlerRef.current = null;
    };
  }, []);

  const requestSessionReset = useCallback(() => {
    sessionResetHandlerRef.current?.();
  }, []);

  if (!client || snapshot === undefined || (snapshot === null && diary && !diary.ready)) return null;

  return (
    <TeaSessionContext.Provider value={{
      secondsStep, setSecondsStep,
      durationSeconds: snapshot?.durationSeconds ?? 10, setDurationSeconds,
      coolingEnabled: snapshot?.coolingEnabled ?? true, setCoolingEnabled,
      coolingDurationMinutes: snapshot?.coolingDurationMinutes ?? DEFAULT_COOLING_MINUTES, adjustCoolingDuration,
      timer: snapshot?.timer ?? null, startTimer, completePour, completeCoolingAlert, stopTimer, resetSession,
      sounds, setSound,
      isStaleSessionPromptOpen: staleSession !== null && staleSession.id === snapshot?.sessionId && !snapshot.timer
        && staleSession.completedAt === snapshot.lastPourCompletedAt,
      continueSession,
      pourCount: snapshot?.pourCount ?? legacyCount, adjustPourCount,
      isTeaCoolingTooLong, setIsTeaCoolingTooLong,
      registerSessionResetHandler, requestSessionReset,
    }}>
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
