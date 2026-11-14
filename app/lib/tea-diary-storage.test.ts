import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { exportDiaryCsv, exportDiaryJson, readDiary, writeDiaryEvent } from './tea-diary-storage';

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); });

describe('persistent diary transactions', () => {
  it('serializes concurrent tabs and keeps all sessions without a 30-entry limit', async () => {
    await Promise.all(Array.from({ length: 45 }, (_, i) => writeDiaryEvent({ id: `start-${i}`, type: 'start', timerId: `timer-${i}`, duration: 5, at: i * 2_000_000 })));
    const state = await readDiary();
    expect(state.sessions).toHaveLength(45);
    expect(new Set(state.sessions.map((session) => session.id)).size).toBe(45);
  });

  it('rejects conflicting notes without overwriting the newer text', async () => {
    await writeDiaryEvent({ id: 's', type: 'start', timerId: 't', duration: 10, at: 1000 });
    await writeDiaryEvent({ id: 'n1', type: 'note', sessionId: 's', note: 'Первый чай', expected: '', at: 1100 });
    await expect(writeDiaryEvent({ id: 'n2', type: 'note', sessionId: 's', note: 'Другой чай', expected: '', at: 1200 })).rejects.toThrow('another tab');
    expect((await readDiary()).sessions[0].note).toBe('Первый чай');
  });

  it('keeps previously saved records when storage fails', async () => {
    await writeDiaryEvent({ id: 's', type: 'start', timerId: 't', duration: 10, at: 1000 });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    await expect(writeDiaryEvent({ id: 'n', type: 'note', sessionId: 's', note: 'чай', at: 1100 })).rejects.toThrow('Full');
    put.mockRestore();
    expect((await readDiary()).sessions[0].note).toBe('');
  });

  it('refuses to overwrite an unsupported stored format', async () => {
    await writeDiaryEvent({ id: 's', type: 'start', timerId: 't', duration: 10, at: 1000 });
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tea-timer-diary', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('records', 'readwrite');
      transaction.objectStore('records').put({ schema: 99, sessions: ['preserve'] }, 'diary');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    await expect(writeDiaryEvent({ id: 'check', type: 'check', at: 2000 })).rejects.toThrow('unsupported');
    await expect(readDiary()).rejects.toThrow('unsupported');
  });

  it('exports UTF-8 notes, escaped CSV and ISO timestamps', async () => {
    await writeDiaryEvent({ id: 's', type: 'start', timerId: 't', duration: 10, at: 1000 });
    const state = await writeDiaryEvent({ id: 'n', type: 'note', sessionId: 's', note: 'Чай, "пуэр"\nвкусный', at: 1100 });
    expect(exportDiaryCsv(state)).toContain('"Чай, ""пуэр""\nвкусный"');
    expect(exportDiaryCsv(state)).toContain('1970-01-01T00:00:01.000Z');
    expect(JSON.parse(exportDiaryJson(state)).sessions[0].note).toBe('Чай, "пуэр"\nвкусный');
  });
});
