'use client';

import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';

export default function SessionResetButton() {
  const { t } = useLanguage();
  const { requestSessionReset } = useTeaSession();

  return (
    <button
      id="session-reset-button"
      type="button"
      className="header-action session-reset-button"
      onClick={requestSessionReset}
      aria-label={t('resetSession')}
      aria-haspopup="dialog"
      aria-controls="session-reset-popup"
      title={t('resetSession')}
    >
      <svg
        className="session-reset-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
