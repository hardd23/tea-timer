import { Capacitor, registerPlugin } from '@capacitor/core';
import { getTimerSound, playTimerSound, unlockTimerAudio, type TimerSoundId, type TimerSounds } from './timer-sounds';

export const TEA_SESSION_KEY = 'tea-timer-session';
const MAX_DURATION = 3595;

export type CoolingDurationMinutes = 1 | 2 | 3 | 4 | 5;
export const DEFAULT_COOLING_MINUTES: CoolingDurationMinutes = 3;
export const MINUTE_MS = 60_000;
export const SESSION_TIMEOUT_MS = 120 * MINUTE_MS;

const validCoolingMinutes = (value: unknown): value is CoolingDurationMinutes =>
  value === 1 || value === 2 || value === 3 || value === 4 || value === 5;

export type SavedTimer = {
  id: string;
  duration: number;
  startedAt: number;
  endAt: number;
} & (
  | { phase: 'brewing' }
  | { phase: 'cooling'; coolingDurationMs: number; coolingAlertEnabled: boolean; coolingAlertHandled: boolean; pourNumber?: number }
);

export type SessionDiaryEvent = { id: string; at: number; sessionId: string } & (
  | { type: 'start'; timerId: string; duration: number }
  | { type: 'complete' | 'stop'; timerId: string }
  | { type: 'adjust'; amount: number }
  | { type: 'reset' }
);

export interface SavedTeaSession {
  schema: 1;
  sessionId: string | null;
  durationSeconds: number;
  coolingEnabled: boolean;
  coolingDurationMinutes: CoolingDurationMinutes;
  timer: SavedTimer | null;
  pourCount: number;
  lastPourCompletedAt?: number;
  sounds?: TimerSounds;
  pendingDiary: SessionDiaryEvent[];
}

export const emptyTeaSession = (): SavedTeaSession => ({
  schema: 1, sessionId: null, durationSeconds: 10, timer: null, pourCount: 0, pendingDiary: [],
  coolingEnabled: true, coolingDurationMinutes: DEFAULT_COOLING_MINUTES,
});

export const sessionId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clampPourCount = (count: number) => Math.min(99, Math.max(0, count));

const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const validTime = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
const validDuration = (value: number) => Number.isInteger(value) && value >= 0 && value <= MAX_DURATION && value % 5 === 0;

function validEvent(event: SessionDiaryEvent) {
  if (!event || !validId(event.id) || !validId(event.sessionId) || !validTime(event.at)) return false;
  switch (event.type) {
    case 'start': return validId(event.timerId) && validDuration(event.duration) && event.duration > 0;
    case 'complete':
    case 'stop': return validId(event.timerId);
    case 'adjust': return Number.isInteger(event.amount) && event.amount !== 0 && Math.abs(event.amount) <= 99;
    case 'reset': return true;
    default: return false;
  }
}

export function parseTeaSession(raw: string | null): SavedTeaSession | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as SavedTeaSession;
    if (!saved || saved.schema !== 1 || !(saved.sessionId === null || validId(saved.sessionId))
      || !validDuration(saved.durationSeconds) || !Number.isInteger(saved.pourCount)
      || saved.pourCount < 0 || saved.pourCount > 99 || (saved.sessionId === null && saved.pourCount !== 0)
      || !Array.isArray(saved.pendingDiary) || !saved.pendingDiary.every(validEvent)) return null;
    const timer = saved.timer;
    if (timer !== null && (!timer || !saved.sessionId || !validId(timer.id) || !validDuration(timer.duration)
      || timer.duration <= 0 || !validTime(timer.startedAt) || !validTime(timer.endAt)
      || timer.endAt !== timer.startedAt + timer.duration * 1000
      || (timer.phase !== 'brewing' && timer.phase !== 'cooling'))) return null;
    const coolingEnabled = saved.coolingEnabled !== false;
    let restoredTimer = timer;
    if (timer?.phase === 'cooling') {
      restoredTimer = {
        ...timer,
        coolingDurationMs: validCoolingMinutes(timer.coolingDurationMs / MINUTE_MS)
          ? timer.coolingDurationMs : DEFAULT_COOLING_MINUTES * MINUTE_MS,
        coolingAlertEnabled: coolingEnabled && timer.coolingAlertEnabled !== false,
        coolingAlertHandled: timer.coolingAlertHandled === true,
      };
    }
    return {
      ...saved,
      lastPourCompletedAt: saved.sessionId && validTime(saved.lastPourCompletedAt ?? -1)
        ? saved.lastPourCompletedAt : undefined,
      coolingEnabled,
      sounds: saved.sounds ? {
        brewing: getTimerSound(saved.sounds.brewing).id,
        cooling: getTimerSound(saved.sounds.cooling).id,
      } : undefined,
      coolingDurationMinutes: validCoolingMinutes(saved.coolingDurationMinutes) ? saved.coolingDurationMinutes : DEFAULT_COOLING_MINUTES,
      timer: restoredTimer,
    };
  } catch {
    return null;
  }
}

const plugin = registerPlugin<{
  read(): Promise<{ value: string | null }>;
  write(options: { value: string }): Promise<void>;
  requestAlerts(): Promise<void>;
  setAlertLanguage(options: { language: 'en' | 'ru' }): Promise<void>;
  signal(options: { timerId: string; phase: SavedTimer['phase'] }): Promise<void>;
  preview(options: { token: string; soundId: TimerSoundId }): Promise<void>;
  stopPreview(options: { token: string }): Promise<void>;
}>('TeaSessionStorage');

export const usesNativeTeaSession = () => Capacitor.getPlatform() === 'android';
export const readNativeTeaSession = async () => parseTeaSession((await plugin.read()).value);
export const writeNativeTeaSession = (snapshot: SavedTeaSession) => plugin.write({ value: JSON.stringify(snapshot) });
export const requestNativeTimerAlerts = () => plugin.requestAlerts();
export const setNativeAlertLanguage = (language: 'en' | 'ru') => plugin.setAlertLanguage({ language });

export function playTimerSignal(timerId: string, phase: SavedTimer['phase'], native: boolean, soundId: TimerSoundId) {
  if (native) void plugin.signal({ timerId, phase }).catch(() => {});
  else playTimerSound(soundId, true);
}

export function previewTimerSound(soundId: TimerSoundId, onFinished: () => void) {
  if (!usesNativeTeaSession()) {
    unlockTimerAudio();
    return playTimerSound(soundId, false, onFinished);
  }

  const token = sessionId();
  let stopped = false;
  const finish = () => { if (!stopped) onFinished(); };
  void plugin.preview({ token, soundId }).then(finish, finish);
  return () => {
    stopped = true;
    void plugin.stopPreview({ token }).catch(() => {});
  };
}

export function readWebTeaSession() {
  try { return parseTeaSession(window.localStorage.getItem(TEA_SESSION_KEY)); }
  catch { return null; }
}

export function writeWebTeaSession(snapshot: SavedTeaSession) {
  window.localStorage.setItem(TEA_SESSION_KEY, JSON.stringify(snapshot));
}
