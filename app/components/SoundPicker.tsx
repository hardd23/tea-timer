'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { previewTimerSound, usesNativeTeaSession } from '../lib/tea-session';
import { prepareTimerSounds, TIMER_SOUNDS, type TimerSoundId } from '../lib/timer-sounds';
import AppDialog from './AppDialog';
import { useLanguage } from './LanguageContext';

interface SoundPickerProps {
  isOpen: boolean;
  selected: TimerSoundId;
  onSelect: (sound: TimerSoundId) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export default function SoundPicker({ isOpen, selected, onSelect, onClose, returnFocusRef }: SoundPickerProps) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<TimerSoundId | null>(null);
  const stopRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (isOpen && !usesNativeTeaSession()) prepareTimerSounds(...TIMER_SOUNDS.map(({ id }) => id));
  }, [isOpen]);

  useEffect(() => {
    const stopPreview = () => {
      stopRef.current?.();
      setPreview(null);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') stopPreview();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopRef.current?.();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const close = () => {
    stopRef.current?.();
    setPreview(null);
    onClose();
  };

  const togglePreview = (id: TimerSoundId) => {
    stopRef.current?.();
    if (preview === id) {
      setPreview(null);
      return;
    }
    setPreview(id);
    stopRef.current = previewTimerSound(id, () => setPreview(null));
  };

  return (
    <AppDialog
      id="sound-picker-dialog"
      isOpen={isOpen}
      labelledBy="sound-picker-title"
      closeLabel={t('closeSoundPicker')}
      contentClassName="sound-picker-panel"
      onRequestClose={close}
      returnFocusRef={returnFocusRef}
    >
      <h2 id="sound-picker-title">{t('selectSound')}</h2>
      <ul className="sound-picker-list">
        {TIMER_SOUNDS.map(({ id, label, url }) => (
          <li key={id}>
            <button type="button" className="sound-picker-choice" aria-pressed={selected === id} onClick={() => {
              onSelect(id);
              close();
            }}>
              {t(label)}
              <span aria-hidden="true">{selected === id ? '✓' : ''}</span>
            </button>
            {url && <button
              type="button"
              className="sound-picker-preview"
              aria-label={`${t(preview === id ? 'stopSoundPreview' : 'previewSound')}: ${t(label)}`}
              onClick={() => togglePreview(id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                {preview === id ? <rect x="7" y="7" width="10" height="10" rx="1" /> : <path d="M9 5.5v13l10-6.5z" strokeLinejoin="round" />}
              </svg>
            </button>}
          </li>
        ))}
      </ul>
    </AppDialog>
  );
}
