'use client';

import { useRef, useState } from 'react';
import teaQuotesData from '../data/tea-quotes-popup-300.ru.json';
import AppDialog from './AppDialog';
import { useLanguage } from './LanguageContext';
import { useTeaSession } from './TeaSessionContext';

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
}

const TEA_QUOTES: TeaQuote[] = teaQuotesData.quotes;

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
}: TeaQuotePopupProps) {
  const { t } = useLanguage();

  return (
    <AppDialog
      id="tea-wisdom-dialog"
      isOpen={isOpen}
      labelledBy="tea-wisdom-title"
      closeLabel={t('closeTeaWisdom')}
      contentClassName="tea-wisdom-panel"
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
        ) : (
          <button type="button" className="tea-wisdom-next" onClick={onNext}>
            {t('more')}
          </button>
        )}
      </div>
    </AppDialog>
  );
}

export default function TeaWisdom() {
  const { t } = useLanguage();
  const { isTeaCoolingTooLong } = useTeaSession();
  const [isOpen, setIsOpen] = useState(false);
  const [quote, setQuote] = useState<TeaQuote>(TEA_QUOTES[0]);
  const remainingIndexesRef = useRef<number[]>([]);
  const lastIndexRef = useRef<number | null>(null);

  const selectNextQuote = () => {
    if (remainingIndexesRef.current.length === 0) {
      remainingIndexesRef.current = createShuffledOrder(TEA_QUOTES.length, lastIndexRef.current);
    }

    const nextIndex = remainingIndexesRef.current.shift();
    if (nextIndex === undefined) return;

    lastIndexRef.current = nextIndex;
    setQuote(TEA_QUOTES[nextIndex]);
  };

  const openWisdom = () => {
    selectNextQuote();
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
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
      />
    </>
  );
}
