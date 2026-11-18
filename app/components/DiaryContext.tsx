'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { emptyDiary, type DiaryEvent, type DiaryState } from '../lib/tea-diary';
import { readDiary, writeDiaryEvent, writeDiaryEvents } from '../lib/tea-diary-storage';
import type { SessionDiaryEvent } from '../lib/tea-session';
import { useLanguage } from './LanguageContext';

type NewEvent = DiaryEvent extends infer E ? E extends DiaryEvent ? Omit<E, 'id' | 'at'> & { at?: number } : never : never;
interface DiaryContextValue {
  state: DiaryState;
  ready: boolean;
  error: boolean;
  record: (event: NewEvent) => void;
  syncSessionEvents: (events: readonly SessionDiaryEvent[]) => Promise<void>;
  retry: () => void;
  saveNote: (sessionId: string, note: string, expected: string) => Promise<boolean>;
}
const DiaryContext = createContext<DiaryContextValue | null>(null);
const eventId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function DiaryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiaryState>(emptyDiary);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const queue = useRef<Array<{ event: DiaryEvent; complete?: (saved: boolean) => void }>>([]);
  const running = useRef(false);
  const mounted = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const owner = useRef(eventId());

  const flush = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length) {
        const item = queue.current[0];
        let result: DiaryState;
        try { result = await writeDiaryEvent(item.event); }
        catch (error) {
          item.complete?.(false);
          item.complete = undefined;
          if (item.event.type === 'note') queue.current.shift();
          if (error instanceof Error && error.message === 'Diary note changed in another tab') {
            const latest = await readDiary();
            if (mounted.current) { setState(latest); setReady(true); setError(true); }
          }
          throw error;
        }
        queue.current.shift();
        item.complete?.(true);
        if (mounted.current && queue.current.length === 0) { setState(result); setReady(true); setError(false); }
        channel.current?.postMessage('changed');
        try { window.localStorage.setItem('tea-timer-diary-pulse', eventId()); } catch { /* BroadcastChannel remains available where supported. */ }
      }
    } catch {
      if (mounted.current) { setError(true); setReady(true); }
    } finally { running.current = false; }
  }, []);

  const record = useCallback((event: NewEvent) => {
    queue.current.push({ event: { ...event, ...(event.type === 'start' ? { owner: owner.current } : {}), id: eventId(), at: event.at ?? Date.now() } as DiaryEvent });
    void flush();
  }, [flush]);

  const syncSessionEvents = useCallback(async (events: readonly SessionDiaryEvent[]) => {
    try {
      const result = await writeDiaryEvents(events);
      if (mounted.current && queue.current.length === 0) {
        setState(result);
        setReady(true);
        setError(false);
      }
      channel.current?.postMessage('changed');
      try { window.localStorage.setItem('tea-timer-diary-pulse', eventId()); } catch { /* BroadcastChannel remains available where supported. */ }
    } catch (error) {
      if (mounted.current) setError(true);
      throw error;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const startedAt = Date.now();
    let cancelled = false;
    let releaseLock: (() => void) | null = null;
    let previousOwner: string | null = null;
    try { previousOwner = window.sessionStorage.getItem('tea-timer-diary-owner'); } catch { /* Recovery remains conservative. */ }
    const acquireOwner = (id: string, recover: boolean) => {
      void navigator.locks.request(`tea-timer-diary-${id}`, { ifAvailable: true }, async (lock) => {
        if (cancelled) return;
        if (!lock) { acquireOwner(eventId(), false); return; }
        owner.current = id;
        try { window.sessionStorage.setItem('tea-timer-diary-owner', id); } catch { /* The diary still works in this tab. */ }
        if (recover) record({ type: 'recover', owner: id, before: startedAt });
        await new Promise<void>((resolve) => { releaseLock = resolve; });
      }).catch(() => { /* Without a reliable lock, do not infer another tab's timer outcome. */ });
    };
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
      acquireOwner(previousOwner || owner.current, Boolean(previousOwner));
    }
    const refresh = () => {
      void readDiary().then((next) => { if (mounted.current && !queue.current.length) { setState(next); setReady(true); } })
        .catch(() => { if (mounted.current) { setError(true); setReady(true); } });
    };
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('tea-timer-diary-changes');
      channel.current.onmessage = refresh;
    }
    void Promise.resolve().then(() => { if (!cancelled) record({ type: 'check' }); });
    const onReturn = () => { if (document.visibilityState === 'visible') record({ type: 'check' }); };
    const onStorage = (event: StorageEvent) => { if (event.key === 'tea-timer-diary-pulse') refresh(); };
    const interval = window.setInterval(() => record({ type: 'check' }), 60_000);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('pageshow', onReturn);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      if (releaseLock) (releaseLock as () => void)();
      mounted.current = false;
      channel.current?.close(); channel.current = null;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('pageshow', onReturn);
      window.removeEventListener('storage', onStorage);
    };
  }, [record]);

  const saveNote = useCallback((sessionId: string, note: string, expected: string) => new Promise<boolean>((complete) => {
    queue.current.push({ event: { id: eventId(), at: Date.now(), type: 'note', sessionId, note, expected }, complete });
    void flush();
  }), [flush]);
  const value = useMemo(() => ({ state, ready, error, record, syncSessionEvents, retry: () => void flush(), saveNote }), [state, ready, error, record, syncSessionEvents, flush, saveNote]);
  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}

export function DiaryWarning() {
  const diary = useDiary();
  const { t } = useLanguage();
  if (!diary?.error) return null;
  return <div className="diary-warning" role="alert">{t('historyError')} <button type="button" onClick={diary.retry}>{t('historyRetry')}</button></div>;
}

export function useDiary() {
  return useContext(DiaryContext);
}
