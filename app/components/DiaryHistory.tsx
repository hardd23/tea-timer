'use client';

import { type RefObject, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { diaryDuration, type DiaryAction } from '../lib/tea-diary';
import { exportDiaryCsv, exportDiaryJson } from '../lib/tea-diary-storage';
import AppDialog from './AppDialog';
import { useDiary } from './DiaryContext';
import { useLanguage } from './LanguageContext';

interface DiaryExportPlugin {
  begin(options: { name: string }): Promise<void>;
  append(options: { data: string }): Promise<void>;
  share(): Promise<void>;
  abort(): Promise<void>;
}

const sameDay = (date: Date, value: number) => {
  const other = new Date(value);
  return date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth() && date.getDate() === other.getDate();
};

function durationText(ms: number, language: string): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (language === 'en') return [hours && `${hours} ${hours === 1 ? 'hour' : 'hours'}`, (rest || !hours) && `${rest} ${rest === 1 ? 'minute' : 'minutes'}`].filter(Boolean).join(' ');
  const form = (n: number, one: string, few: string, many: string) => n % 100 >= 11 && n % 100 <= 14 ? many : n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many;
  return [hours && `${hours} ${form(hours, 'час', 'часа', 'часов')}`, (rest || !hours) && `${rest} ${form(rest, 'минута', 'минуты', 'минут')}`].filter(Boolean).join(' ');
}

export default function DiaryHistory({ isOpen, onClose, returnFocusRef }: { isOpen: boolean; onClose: () => void; returnFocusRef: RefObject<HTMLElement | null> }) {
  const diary = useDiary();
  const { language, t } = useLanguage();
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [day, setDay] = useState<Date | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [exportError, setExportError] = useState(false);
  const sessions = diary?.state.sessions ?? [];
  const session = sessions.find((item) => item.id === sessionId);
  const monthSessions = sessions.filter((item) => { const date = new Date(item.startedAt); return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(); });
  const daySessions = day ? monthSessions.filter((item) => sameDay(day, item.startedAt)).sort((a, b) => b.startedAt - a.startedAt) : [];
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const formatTime = (time: number) => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(time);

  const exportFile = async (format: 'csv' | 'json') => {
    if (!diary) return;
    setExportError(false);
    let androidExport: DiaryExportPlugin | null = null;
    try {
      const text = format === 'csv' ? exportDiaryCsv(diary.state) : exportDiaryJson(diary.state);
      const name = `tea-timer-history.${format}`;
      if (Capacitor.getPlatform() === 'android') {
        const plugin = registerPlugin<DiaryExportPlugin>('TeaDiaryExport');
        await plugin.begin({ name });
        androidExport = plugin;
        const bytes = new TextEncoder().encode(text);
        for (let i = 0; i < bytes.length; i += 24_576) {
          const chunk = bytes.subarray(i, i + 24_576);
          let binary = '';
          for (const byte of chunk) binary += String.fromCharCode(byte);
          await plugin.append({ data: btoa(binary) });
        }
        await plugin.share();
        androidExport = null;
      } else {
        const url = URL.createObjectURL(new Blob([text], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch {
      if (androidExport) await androidExport.abort().catch(() => {});
      setExportError(true);
    }
  };

  const actionText = (action: DiaryAction) => {
    switch (action.type) {
      case 'start': return `${t('historyStarted')}${action.pour ? ` · №${action.pour}` : ''} · ${Math.floor(action.duration / 60).toString().padStart(2, '0')}:${(action.duration % 60).toString().padStart(2, '0')}`;
      case 'complete': return `${t('historyComplete')} · ${t('historyPours')}: ${action.count}`;
      case 'stop': return t('historyStopped');
      case 'interrupted': return t('historyInterrupted');
      case 'adjust': return `${t('historyAdjusted')}: ${action.before} → ${action.after}`;
      case 'quote': return t('historyQuote');
      case 'reset': return t('historyReset');
    }
  };

  return (
    <AppDialog id="tea-history-dialog" isOpen={isOpen} labelledBy="tea-history-title" closeLabel={t('historyClose')} contentClassName="tea-history-panel" fullScreen onRequestClose={onClose} returnFocusRef={returnFocusRef}>
      <div className="tea-history-content">
        <h2 id="tea-history-title">{t('historyTitle')}</h2>
        <p>{t('historyPrivacy')}</p>
        {diary?.error ? <p role="alert">{t('historyError')} <button type="button" onClick={diary.retry}>{t('historyRetry')}</button></p> : null}
        {!diary?.ready ? <p role="status">{t('historyLoading')}</p> : null}
        {day || sessionId ? <button type="button" className="history-back history-nav-back" onClick={() => { if (sessionId) { setSessionId(null); setEditing(false); } else setDay(null); }}>{t('historyBack')}</button> : null}
        {!day && !sessionId ? (
          <>
            <div className="history-month"><button type="button" aria-label={t('historyPrevious')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(month)}</strong><button type="button" aria-label={t('historyNext')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
            <p>{t('historyMonthCount')}: {monthSessions.length}</p>
            <div className="history-calendar" role="group" aria-label={new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' }).format(month)}>
              {Array.from({ length: 7 }, (_, index) => <span className="history-weekday" key={`weekday-${index}`}>{new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(2024, 0, 1 + index))}</span>)}
              {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
              {Array.from({ length: days }, (_, index) => {
                const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
                const count = monthSessions.filter((item) => sameDay(date, item.startedAt)).length;
                return <button type="button" key={index} className={count ? 'history-day has-sessions' : 'history-day'} aria-label={`${new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(date)} · ${t('historyDayCount')}: ${count}`} onClick={() => setDay(date)}>{index + 1}</button>;
              })}
            </div>
            <div className="history-exports"><button type="button" disabled={!diary?.ready || diary.error} onClick={() => void exportFile('csv')}>CSV</button><button type="button" disabled={!diary?.ready || diary.error} onClick={() => void exportFile('json')}>JSON</button></div>
            {exportError ? <p role="alert">{t('historyExportError')}</p> : null}
          </>
        ) : null}
        {day && !sessionId ? <><h3>{new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(day)}</h3>{daySessions.length === 0 ? <p>{t('historyEmpty')}</p> : <div className="history-list">{daySessions.map((item) => <button type="button" key={item.id} onClick={() => { setSessionId(item.id); setNote(item.note); }}><span>{formatTime(item.startedAt)}{item.endedAt === null ? ` · ${t('historyCurrent')}` : ''}</span><span>{t('historyPours')}: {item.count}</span></button>)}</div>}</> : null}
        {session ? <>
          <h3>{new Intl.DateTimeFormat(language, { dateStyle: 'long', timeStyle: 'short' }).format(session.startedAt)}</h3>
          <div className="history-summary"><p>{t('historyDuration')}: {diaryDuration(session) === null ? t('historyNoDuration') : `${t('historyApprox')} ${durationText(diaryDuration(session)!, language)}`}</p><p>{t('historyPours')}: {session.count}</p><p>{t('historyQuotes')}: {session.quotes}</p></div>
          <h3>{t('historyActions')}</h3>
          <ol className="history-actions">{[...session.actions].sort((a, b) => a.at - b.at).map((action) => <li key={action.id}><time>{formatTime(action.at)}</time><span>{actionText(action)}</span></li>)}</ol>
          {session.note && !editing ? <section><h3>{t('historyNote')}</h3><p className="history-note">{session.note}</p></section> : null}
          {editing ? <div className="history-note-editor"><label htmlFor="history-note">{t('historyNote')}</label><textarea id="history-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /><span>{note.length}/500</span><div><button type="button" onClick={() => { void diary?.saveNote(session.id, note, session.note).then((saved) => { if (saved) setEditing(false); }); }}>{t('historySave')}</button><button type="button" onClick={() => { setNote(session.note); setEditing(false); }}>{t('historyCancel')}</button></div></div> : <details><summary>{t('historyRecordMenu')}</summary><button type="button" className="history-back" onClick={() => { setNote(session.note); setEditing(true); }}>{t('historyEditNote')}</button></details>}
        </> : null}
      </div>
    </AppDialog>
  );
}
