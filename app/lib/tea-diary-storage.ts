import { applyDiaryEvent, emptyDiary, type DiaryEvent, type DiaryState } from './tea-diary';

const DB_NAME = 'tea-timer-diary';
const STORE = 'records';
const KEY = 'diary';

function validState(value: unknown): value is DiaryState {
  if (!value || typeof value !== 'object') return false;
  const state = value as DiaryState;
  if (state.schema !== 1 || !Array.isArray(state.sessions) || !(state.activeId === null || typeof state.activeId === 'string')) return false;
  const ids = new Set<string>();
  for (const session of state.sessions) {
    if (!session || typeof session.id !== 'string' || ids.has(session.id) || !Number.isFinite(session.startedAt)
      || !Number.isFinite(session.lastActivity) || !(session.endedAt === null || Number.isFinite(session.endedAt))
      || !Number.isInteger(session.count) || session.count < 0 || session.count > 99
      || !Number.isInteger(session.quotes) || session.quotes < 0 || typeof session.note !== 'string'
      || session.note.length > 500 || !Array.isArray(session.actions)) return false;
    ids.add(session.id);
    for (const action of session.actions) {
      if (!action || typeof action.id !== 'string' || !Number.isFinite(action.at)
        || !['start', 'complete', 'stop', 'interrupted', 'adjust', 'quote', 'reset'].includes(action.type)) return false;
      if (action.type === 'start' && (typeof action.timerId !== 'string' || !Number.isFinite(action.duration) || action.duration <= 0 || (action.owner !== undefined && typeof action.owner !== 'string') || (action.pour !== undefined && (!Number.isInteger(action.pour) || action.pour < 1 || action.pour > 99)))) return false;
      if ((action.type === 'complete' || action.type === 'stop' || action.type === 'interrupted')
        && (typeof action.timerId !== 'string' || !Number.isInteger(action.count))) return false;
      if (action.type === 'adjust' && (!Number.isInteger(action.before) || !Number.isInteger(action.after) || (action.amount !== undefined && !Number.isInteger(action.amount)))) return false;
    }
  }
  return state.activeId === null || ids.has(state.activeId);
}

function openDiary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Diary storage is unavailable')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open diary'));
    request.onblocked = () => reject(new Error('Diary upgrade blocked by another tab'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export async function readDiary(): Promise<DiaryState> {
  const db = await openDiary();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).get(KEY);
    request.onsuccess = () => {
      const value: unknown = request.result;
      if (value === undefined) resolve(emptyDiary());
      else if (validState(value)) resolve(value);
      else reject(new Error('Diary data is damaged or has an unsupported version'));
    };
    request.onerror = () => reject(request.error ?? new Error('Could not read diary'));
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Diary read failed')); };
  });
}

export async function writeDiaryEvent(event: DiaryEvent): Promise<DiaryState> {
  const db = await openDiary();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const request = store.get(KEY);
    let next: DiaryState | null = null;
    let failure: Error | null = null;
    request.onsuccess = () => {
      const value: unknown = request.result;
      if (value !== undefined && !validState(value)) {
        failure = new Error('Diary data is damaged or has an unsupported version');
        transaction.abort();
        return;
      }
      try {
        next = applyDiaryEvent(value === undefined ? emptyDiary() : value as DiaryState, event);
        if (!validState(next)) throw new Error('Diary event would create invalid data');
        store.put(next, KEY);
      } catch (error) {
        failure = error instanceof Error ? error : new Error('Diary update failed');
        transaction.abort();
      }
    };
    transaction.oncomplete = () => { db.close(); if (next) resolve(next); else reject(new Error('Diary update failed')); };
    transaction.onabort = () => { db.close(); reject(failure ?? transaction.error ?? new Error('Diary update failed')); };
    transaction.onerror = () => { /* The abort handler reports quota and storage errors. */ };
  });
}

const csvField = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
export function exportDiaryCsv(state: DiaryState): string {
  const rows: unknown[][] = [['session_id', 'started_at', 'ended_at', 'count', 'quotes', 'note', 'action_type', 'action_at', 'action_data']];
  for (const session of state.sessions) {
    const base = [session.id, new Date(session.startedAt).toISOString(), session.endedAt === null ? '' : new Date(session.endedAt).toISOString(), session.count, session.quotes, session.note];
    if (session.actions.length === 0) rows.push([...base, '', '', '']);
    for (const action of session.actions) rows.push([...base, action.type, new Date(action.at).toISOString(), JSON.stringify(action)]);
  }
  return '\ufeff' + rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

export const exportDiaryJson = (state: DiaryState) => JSON.stringify(state, null, 2);
