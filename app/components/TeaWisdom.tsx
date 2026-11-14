'use client';

import { type CSSProperties, type RefObject, useEffect, useRef, useState } from 'react';
import teaQuotesData from '../data/tea-quotes-popup-300.ru.json';
import AppDialog from './AppDialog';
import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';
import { useDiary } from './DiaryContext';

interface TeaQuote {
  id: string;
  text: string;
  author: string;
}

interface TeaQuotePopupProps {
  quote: TeaQuote;
  isOpen: boolean;
  isTeaCoolingTooLong: boolean;
  onClose: () => void;
  onNext: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  remainingMs: number;
}

const TEA_QUOTES: TeaQuote[] = teaQuotesData.quotes;
const QUOTE_COOLDOWN_MS = 10_000;

const createShuffledOrder = (length: number, previousIndex: number | null) => {
  const order = Array.from({ length }, (_, index) => index);

  for (let index = order.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[randomIndex]] = [order[randomIndex], order[index]];
  }

  if (length > 1 && order[0] === previousIndex) {
    [order[0], order[1]] = [order[1], order[0]];
  }

  return order;
};

function TeaQuotePopup({
  quote,
  isOpen,
  isTeaCoolingTooLong,
  onClose,
  onNext,
  triggerRef,
  remainingMs,
}: TeaQuotePopupProps) {
  const { t } = useLanguage();
  const waiting = remainingMs > 0;
  const progress = 1 - remainingMs / QUOTE_COOLDOWN_MS;

  return (
    <AppDialog
      id="tea-wisdom-dialog"
      isOpen={isOpen}
      labelledBy="tea-wisdom-title"
      closeLabel={t('closeTeaWisdom')}
      contentClassName="tea-wisdom-panel"
      fullScreen
      returnFocusRef={triggerRef}
      onRequestClose={onClose}
    >
      <div className="tea-wisdom-content">
        <p className="tea-wisdom-mark" aria-hidden="true">茶</p>
        <blockquote id="tea-wisdom-title" className="tea-wisdom-quote">
          {quote.text}
        </blockquote>
        <p className="tea-wisdom-author">— {quote.author}</p>
        {isTeaCoolingTooLong ? (
          <p className="tea-wisdom-cooling-notice" aria-live="polite">
            {t('teaCooling')}
          </p>
        ) : null}
        <button
          type="button"
          className="tea-wisdom-next"
          onClick={onNext}
          disabled={waiting}
          aria-describedby="tea-wisdom-cooldown-status"
          style={{ '--quote-progress': progress } as CSSProperties}
        >
          <span className="tea-wisdom-next-label">{t('more')}</span>
          <span className="tea-wisdom-next-filled-label" aria-hidden="true">{t('more')}</span>
        </button>
        <p id="tea-wisdom-cooldown-status" className="tea-wisdom-cooldown-status" role="status">
          {waiting ? `${t('quoteWait')} ${Math.ceil(remainingMs / 1000)} ${t('seconds')}` : t('quoteReady')}
        </p>
      </div>
    </AppDialog>
  );
}

export default function TeaWisdom() {
  const { t } = useLanguage();
  const { isTeaCoolingTooLong } = useTeaSession();
  const recordDiary = useDiary()?.record;
  const [isOpen, setIsOpen] = useState(false);
  const [quote, setQuote] = useState<TeaQuote>(TEA_QUOTES[0]);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const remainingIndexesRef = useRef<number[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen || deadline === null) return;
    const update = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= deadline) window.clearInterval(timer);
    };
    const timer = window.setInterval(update, 100);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('focus', update);
    };
  }, [deadline, isOpen]);

  const selectNextQuote = () => {
    if (deadline !== null && Date.now() < deadline) return;
    if (remainingIndexesRef.current.length === 0) {
      remainingIndexesRef.current = createShuffledOrder(TEA_QUOTES.length, lastIndexRef.current);
    }

    const nextIndex = remainingIndexesRef.current.shift();
    if (nextIndex === undefined) return;

    lastIndexRef.current = nextIndex;
    setQuote(TEA_QUOTES[nextIndex]);
    recordDiary?.({ type: 'quote' });
    const startedAt = Date.now();
    setNow(startedAt);
    setDeadline(startedAt + QUOTE_COOLDOWN_MS);
  };

  const openWisdom = () => {
    if (lastIndexRef.current === null) selectNextQuote();
    else { setNow(Date.now()); recordDiary?.({ type: 'quote' }); }
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="header-action tea-wisdom-trigger"
        onClick={openWisdom}
        aria-label={t('openTeaWisdom')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="tea-wisdom-dialog"
        title={t('teaWisdom')}
      >
        <svg
          viewBox="0 0 24 24"
          className="tea-wisdom-trigger-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M5 11.5h5V17H4.5v-4.5c0-3 1.3-5.1 4-6.4M15 11.5h5V17h-5.5v-4.5c0-3 1.3-5.1 4-6.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <TeaQuotePopup
        quote={quote}
        isOpen={isOpen}
        isTeaCoolingTooLong={isTeaCoolingTooLong}
        onClose={() => setIsOpen(false)}
        onNext={selectNextQuote}
        triggerRef={triggerRef}
        remainingMs={deadline === null ? 0 : Math.max(0, Math.min(QUOTE_COOLDOWN_MS, deadline - now))}
      />
    </>
  );
}
