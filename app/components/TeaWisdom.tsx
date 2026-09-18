'use client';

import { useEffect, useRef, useState } from 'react';
import teaQuotesData from '../data/tea-quotes-popup-300.ru.json';

interface TeaQuote {
  id: string;
  text: string;
  author: string;
}

interface TeaQuotePopupProps {
  quote: TeaQuote;
  isOpen: boolean;
  onClose: () => void;
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

function TeaQuotePopup({ quote, isOpen, onClose }: TeaQuotePopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      id="tea-wisdom-dialog"
      ref={dialogRef}
      className="tea-wisdom-dialog"
      aria-labelledby="tea-wisdom-title"
      onClose={onClose}
    >
      <button
        type="button"
        className="tea-wisdom-close"
        onClick={() => dialogRef.current?.close()}
        aria-label="Закрыть чайное высказывание"
        autoFocus
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M5 5l14 14M19 5 5 19" strokeLinecap="round" />
        </svg>
      </button>

      <div className="tea-wisdom-content">
        <p className="tea-wisdom-mark" aria-hidden="true">茶</p>
        <blockquote id="tea-wisdom-title" className="tea-wisdom-quote">
          {quote.text}
        </blockquote>
        <p className="tea-wisdom-author">— {quote.author}</p>
      </div>
    </dialog>
  );
}

export default function TeaWisdom() {
  const [isOpen, setIsOpen] = useState(false);
  const [quote, setQuote] = useState<TeaQuote>(TEA_QUOTES[0]);
  const remainingIndexesRef = useRef<number[]>([]);
  const lastIndexRef = useRef<number | null>(null);

  const openWisdom = () => {
    if (remainingIndexesRef.current.length === 0) {
      remainingIndexesRef.current = createShuffledOrder(
        TEA_QUOTES.length,
        lastIndexRef.current,
      );
    }

    const nextIndex = remainingIndexesRef.current.shift();
    if (nextIndex === undefined) return;

    lastIndexRef.current = nextIndex;
    setQuote(TEA_QUOTES[nextIndex]);
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="header-action tea-wisdom-trigger"
        onClick={openWisdom}
        aria-label="Открыть чайное высказывание"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="tea-wisdom-dialog"
        title="Чайное высказывание"
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
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
