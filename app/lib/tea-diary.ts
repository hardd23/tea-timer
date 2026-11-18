export const DIARY_IDLE_MS = 30 * 60 * 1000;

export type DiaryAction =
  | { id: string; at: number; type: 'start'; timerId: string; duration: number; owner?: string; pour?: number }
  | { id: string; at: number; type: 'complete' | 'stop' | 'interrupted'; timerId: string; count: number }
  | { id: string; at: number; type: 'adjust'; before: number; after: number; amount?: number }
  | { id: string; at: number; type: 'quote' | 'reset' };

export interface DiarySession {
  id: string;
  startedAt: number;
  lastActivity: number;
  endedAt: number | null;
  count: number;
  quotes: number;
  note: string;
  actions: DiaryAction[];
  persistent?: true;
}

export interface DiaryState {
  schema: 1;
  activeId: string | null;
  sessions: DiarySession[];
}

export type DiaryEvent = { sessionId?: string } & (
  | { id: string; at: number; type: 'start'; timerId: string; duration: number; owner?: string }
  | { id: string; at: number; type: 'complete' | 'stop' | 'interrupted'; timerId: string }
  | { id: string; at: number; type: 'adjust'; amount: number }
  | { id: string; at: number; type: 'quote' | 'reset' | 'check' }
  | { id: string; at: number; type: 'recover'; owner: string; before: number }
  | { id: string; at: number; type: 'note'; sessionId: string; note: string; expected?: string }
);

export const emptyDiary = (): DiaryState => ({ schema: 1, activeId: null, sessions: [] });

export function diaryDuration(session: DiarySession): number | null {
  const completions = session.actions.filter((action) => action.type === 'complete');
  if (completions.length === 0) return null;
  const last = Math.max(...completions.map((action) => action.at));
  return Math.max(0, last - session.startedAt) + 8 * 60 * 1000;
}

function runningTimers(session: DiarySession) {
  const running = new Map<string, { at: number; duration: number }>();
  for (const action of session.actions) {
    if (action.type === 'start') running.set(action.timerId, action);
    else if (action.type === 'complete' || action.type === 'stop' || action.type === 'interrupted') running.delete(action.timerId);
  }
  return running;
}

function reconcileCounts(session: DiarySession) {
  session.actions.sort((a, b) => a.at - b.at);
  let count = 0;
  for (const action of session.actions) {
    if (action.type === 'start') action.pour = Math.min(99, count + 1);
    else if (action.type === 'adjust') {
      const amount = action.amount ?? action.after - action.before;
      action.amount = amount;
      action.before = count;
      count = Math.min(99, Math.max(0, count + amount));
      action.after = count;
    } else if (action.type === 'complete') {
      count = Math.min(99, count + 1);
      action.count = count;
    } else if (action.type === 'stop' || action.type === 'interrupted') action.count = count;
  }
  session.count = count;
}

export function applyDiaryEvent(original: DiaryState, event: DiaryEvent): DiaryState {
  const state: DiaryState = {
    ...original,
    sessions: original.sessions.map((session) => ({
      ...session, actions: session.actions.map((action) => ({ ...action })),
    })),
  };
  if (state.sessions.some((session) => session.actions.some((action) => action.id === event.id))) return state;
  if (event.type === 'start' && state.sessions.some((session) => session.actions.some(
    (action) => action.type === 'start' && action.timerId === event.timerId,
  ))) return state;
  const active = state.sessions.find((session) => session.id === state.activeId);
  const at = Math.max(0, event.at);

  if (event.type === 'note') {
    const session = state.sessions.find((item) => item.id === event.sessionId);
    if (session) {
      if (event.expected !== undefined && event.expected !== session.note) throw new Error('Diary note changed in another tab');
      session.note = event.note.slice(0, 500);
    }
    return state;
  }

  if (event.type === 'recover') {
    if (!active || active.persistent) return state;
    for (const [timerId, timer] of runningTimers(active)) {
      const start = active.actions.find((action) => action.type === 'start' && action.timerId === timerId);
      if (start?.type === 'start' && start.owner === event.owner && timer.at < event.before) {
        active.actions.push({ id: `interrupted:${timerId}`, at: timer.at, type: 'interrupted', timerId, count: active.count });
      }
    }
    return state;
  }

  const resolvesRunningTimer = active && (event.type === 'complete' || event.type === 'stop' || event.type === 'interrupted')
    && runningTimers(active).has(event.timerId);
  if (active && !active.persistent && !event.sessionId && !resolvesRunningTimer && at >= active.lastActivity + DIARY_IDLE_MS &&
      [...runningTimers(active).values()].every((timer) => at >= timer.at + timer.duration * 1000)) {
    for (const [timerId] of runningTimers(active)) {
      active.actions.push({ id: `interrupted:${timerId}`, at: Math.max(active.startedAt, active.lastActivity), type: 'interrupted', timerId, count: active.count });
    }
    active.endedAt = Math.max(active.startedAt, active.lastActivity);
    state.activeId = null;
  }

  let session = state.sessions.find((item) => item.id === (event.sessionId ?? state.activeId));
  if ((event.type === 'start' || (event.type === 'adjust' && event.sessionId)) && !session) {
    session = { id: event.sessionId ?? event.id, startedAt: at, lastActivity: at, endedAt: null, count: 0, quotes: 0, note: '', actions: [] };
    state.sessions.push(session);
    state.activeId = session.id;
  }
  if (event.sessionId && session) {
    // A legacy session can expire before the persisted timer's outbox reaches IndexedDB.
    if (!session.persistent && session.endedAt !== null && !session.actions.some((action) => action.type === 'reset')) {
      session.endedAt = null;
      state.activeId = session.id;
    }
    session.persistent = true;
  }

  if (event.type === 'start' && session && session.endedAt === null) {
    session.actions.push({ id: event.id, at: Math.max(session.startedAt, at), type: 'start', timerId: event.timerId, duration: event.duration, ...(event.owner ? { owner: event.owner } : {}) });
    reconcileCounts(session);
    session.lastActivity = Math.max(session.lastActivity, at);
    return state;
  }

  if (event.type === 'check') return state;
  if (!event.sessionId && (event.type === 'complete' || event.type === 'stop' || event.type === 'interrupted')) {
    session = state.sessions.find((item) => item.actions.some((action) => action.type === 'start' && action.timerId === event.timerId));
  }
  if (!session || (event.sessionId && session.endedAt !== null)) return state;
  const eventTime = Math.max(session.startedAt, at);
  if (event.type === 'complete' || event.type === 'stop' || event.type === 'interrupted') {
    if (event.type === 'stop' && !runningTimers(session).has(event.timerId)
      && session.endedAt === null
      && session.actions.some((action) => action.type === 'complete' && action.timerId === event.timerId)
      && !session.actions.some((action) => action.type === 'stop' && action.timerId === event.timerId)) {
      session.actions.push({ id: event.id, at: eventTime, type: 'stop', timerId: event.timerId, count: session.count });
      reconcileCounts(session);
      session.lastActivity = Math.max(session.lastActivity, eventTime);
      return state;
    }
    if (event.type !== 'interrupted' && !runningTimers(session).has(event.timerId)) {
      const uncertain = session.actions.findIndex((action) => action.type === 'interrupted' && action.timerId === event.timerId);
      if (uncertain >= 0) session.actions.splice(uncertain, 1);
    }
    if (!runningTimers(session).has(event.timerId)) return state;
    if (event.type === 'complete') session.count = Math.min(99, session.count + 1);
    session.actions.push({ id: event.id, at: eventTime, type: event.type, timerId: event.timerId, count: session.count });
    reconcileCounts(session);
    session.lastActivity = Math.max(session.lastActivity, eventTime);
    if (session.endedAt !== null) session.endedAt = Math.max(session.endedAt, eventTime);
  } else if (event.type === 'adjust') {
    const before = session.count;
    const after = Math.max(0, Math.min(99, before + event.amount));
    if (event.amount !== 0) {
      session.count = after;
      session.actions.push({ id: event.id, at: eventTime, type: 'adjust', before, after, amount: event.amount });
      reconcileCounts(session);
      session.lastActivity = Math.max(session.lastActivity, eventTime);
    }
  } else if (event.type === 'quote') {
    session.quotes += 1;
    session.actions.push({ id: event.id, at: eventTime, type: 'quote' });
  } else if (event.type === 'reset') {
    for (const [timerId] of runningTimers(session)) {
      session.actions.push({ id: `reset:${timerId}`, at: eventTime, type: 'stop', timerId, count: session.count });
    }
    session.actions.push({ id: event.id, at: eventTime, type: 'reset' });
    reconcileCounts(session);
    session.lastActivity = Math.max(session.lastActivity, eventTime);
    session.endedAt = session.lastActivity;
    if (state.activeId === session.id) state.activeId = null;
  }
  return state;
}
