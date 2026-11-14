import { describe, expect, it } from 'vitest';
import { applyDiaryEvent, diaryDuration, emptyDiary, type DiaryEvent } from './tea-diary';
import { exportDiaryCsv, exportDiaryJson, readDiary, writeDiaryEvent } from './tea-diary-storage';

function sequence(events: DiaryEvent[]) {
  return events.reduce(applyDiaryEvent, emptyDiary());
}

describe('tea diary model', () => {
  it('recovers only the previous owner’s timer and permits a real late completion', () => {
    const state = sequence([
      { id: 's1', at: 1000, type: 'start', timerId: 'a', duration: 60, owner: 'tab-a' },
      { id: 's2', at: 2000, type: 'start', timerId: 'b', duration: 60, owner: 'tab-b' },
      { id: 'recovery', at: 3000, type: 'recover', owner: 'tab-a', before: 3000 },
    ]);
    expect(state.sessions[0].actions.filter((action) => action.type === 'interrupted').map((action) => action.timerId)).toEqual(['a']);
    const completed = applyDiaryEvent(state, { id: 'done', at: 61000, type: 'complete', timerId: 'a' });
    expect(completed.sessions[0].actions.some((action) => action.type === 'interrupted')).toBe(false);
    expect(completed.sessions[0].count).toBe(1);
  });
  it('records timers, manual changes, quotes and a reset without duplicating completion', () => {
    const state = sequence([
      { id: 's1', at: 1000, type: 'start', timerId: 'a', duration: 10 },
      { id: 'done', at: 11000, type: 'complete', timerId: 'a' },
      { id: 'done', at: 11000, type: 'complete', timerId: 'a' },
      { id: 'adjust', at: 12000, type: 'adjust', amount: 1 },
      { id: 'quote', at: 13000, type: 'quote' },
      { id: 's2', at: 14000, type: 'start', timerId: 'b', duration: 10 },
      { id: 'stop', at: 16000, type: 'stop', timerId: 'b' },
      { id: 'reset', at: 17000, type: 'reset' },
    ]);
    expect(state.activeId).toBeNull();
    expect(state.sessions[0]).toMatchObject({ count: 2, quotes: 1, endedAt: 17000 });
    expect(state.sessions[0].actions.map((action) => action.type)).toEqual(['start', 'complete', 'adjust', 'quote', 'start', 'stop', 'reset']);
    expect(diaryDuration(state.sessions[0])).toBe(490000);
  });

  it('keeps a long countdown open and closes after 30 minutes of inactivity', () => {
    const started = sequence([{ id: 's', at: 1000, type: 'start', timerId: 'a', duration: 2400 }]);
    const after31 = applyDiaryEvent(started, { id: 'check', at: 31 * 60 * 1000, type: 'check' });
    expect(after31.activeId).toBe('s');
    const completed = applyDiaryEvent(after31, { id: 'done', at: 2401000, type: 'complete', timerId: 'a' });
    expect(completed.sessions[0].count).toBe(1);
    const after10 = applyDiaryEvent(completed, { id: 'check2', at: 2401000 + 10 * 60 * 1000, type: 'check' });
    expect(after10.activeId).toBe('s');
    const after31Idle = applyDiaryEvent(after10, { id: 'check3', at: 2401000 + 31 * 60 * 1000, type: 'check' });
    expect(after31Idle.activeId).toBeNull();
    const next = applyDiaryEvent(after31Idle, { id: 'new', at: 2401000 + 32 * 60 * 1000, type: 'start', timerId: 'b', duration: 5 });
    expect(next.sessions).toHaveLength(2);
    expect(next.sessions[1].count).toBe(0);
  });

  it('reconciles a delayed completion without counting a repeated timer twice', () => {
    const state = sequence([
      { id: 'start', at: 1000, type: 'start', timerId: 'a', duration: 10 },
      { id: 'duplicate-start', at: 1000, type: 'start', timerId: 'a', duration: 10 },
      { id: 'background-check', at: 31 * 60 * 1000, type: 'check' },
      { id: 'complete', at: 11000, type: 'complete', timerId: 'a' },
      { id: 'duplicate-complete', at: 11000, type: 'complete', timerId: 'a' },
    ]);
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].actions.map((action) => action.type)).toEqual(['start', 'complete']);
    expect(state.sessions[0].count).toBe(1);
    expect(diaryDuration(state.sessions[0])).toBe(490000);
  });

  it('does not invent a duration without a completed brew', () => {
    const state = sequence([{ id: 's', at: 10000, type: 'start', timerId: 'a', duration: 10 }, { id: 'stop', at: 5000, type: 'stop', timerId: 'a' }]);
    expect(diaryDuration(state.sessions[0])).toBeNull();
    expect(state.sessions[0].actions[1].at).toBe(10000);
  });

  it('records stopping cooling as activity without cancelling the completed brew', () => {
    const state = sequence([
      { id: 's', at: 1000, type: 'start', timerId: 'a', duration: 10 },
      { id: 'done', at: 11000, type: 'complete', timerId: 'a' },
      { id: 'stop', at: 15000, type: 'stop', timerId: 'a' },
      { id: 'duplicate', at: 15000, type: 'stop', timerId: 'a' },
    ]);
    expect(state.sessions[0].actions.map((action) => action.type)).toEqual(['start', 'complete', 'stop']);
    expect(state.sessions[0].count).toBe(1);
    expect(state.sessions[0].lastActivity).toBe(15000);
    expect(diaryDuration(state.sessions[0])).toBe(490000);
  });

  it('reconciles late completions before manual changes and numbers later timers chronologically', () => {
    const state = sequence([
      { id: 's', at: 1000, type: 'start', timerId: 'a', duration: 10 },
      { id: 'adjust', at: 20000, type: 'adjust', amount: 1 },
      { id: 'next', at: 21000, type: 'start', timerId: 'b', duration: 10 },
      { id: 'done', at: 11000, type: 'complete', timerId: 'a' },
    ]);
    expect(state.sessions[0].actions.map((action) => action.type)).toEqual(['start', 'complete', 'adjust', 'start']);
    expect(state.sessions[0].actions[2]).toMatchObject({ before: 1, after: 2 });
    expect(state.sessions[0].actions[3]).toMatchObject({ pour: 3 });
    expect(state.sessions[0].count).toBe(2);
  });

  it('exports Cyrillic and escaped notes and reports storage unavailability', async () => {
    const state = sequence([{ id: 's', at: 1000, type: 'start', timerId: 'a', duration: 5 }, { id: 'note', at: 1001, type: 'note', sessionId: 's', note: 'Чай, "пуэр"\nхороший' }]);
    expect(exportDiaryCsv(state)).toContain('"Чай, ""пуэр""\nхороший"');
    expect(exportDiaryJson(state)).toContain('Чай');
    await expect(readDiary()).rejects.toThrow('unavailable');
    await expect(writeDiaryEvent({ id: 'x', at: 0, type: 'check' })).rejects.toThrow('unavailable');
  });
});
