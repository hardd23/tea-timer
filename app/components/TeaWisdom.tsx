'use client';

import { useEffect, useRef, useState } from 'react';

interface TeaSaying {
  text: string;
  author?: string;
}

// Add the supplied sayings here. The queue below shows each one once per cycle.
const TEA_SAYINGS: TeaSaying[] = [];

const PLACEHOLDER_SAYING: TeaSaying = {
  text: 'Здесь появится чайное высказывание.',
};

const EXHAUSTED_SAYING: TeaSaying = {
  text: 'Все чайные высказывания этого чаепития уже показаны.',
};

const createShuffledOrder = (length: number) => {
  const order = Array.from({ length }, (_, index) => index);

  for (let index = order.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[randomIndex]] = [order[randomIndex], order[index]];
  }

  return order;
};

export default function TeaWisdom() {
  const [isOpen, setIsOpen] = useState(false);
  const [saying, setSaying] = useState<TeaSaying>(PLACEHOLDER_SAYING);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const remainingIndexesRef = useRef<number[] | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const openWisdom = () => {
    if (TEA_SAYINGS.length === 0) {
      setSaying(PLACEHOLDER_SAYING);
      setIsOpen(true);
      return;
    }

    if (remainingIndexesRef.current === null) {
      remainingIndexesRef.current = createShuffledOrder(TEA_SAYINGS.length);
    }

    const nextIndex = remainingIndexesRef.current.shift();
    if (nextIndex === undefined) {
      setSaying(EXHAUSTED_SAYING);
      setIsOpen(true);
      return;
    }

    setSaying(TEA_SAYINGS[nextIndex]);
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

      <dialog
        id="tea-wisdom-dialog"
        ref={dialogRef}
        className="tea-wisdom-dialog"
        aria-labelledby="tea-wisdom-title"
        onClose={() => setIsOpen(false)}
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
            {saying.text}
          </blockquote>
          {saying.author ? (
            <p className="tea-wisdom-author">— {saying.author}</p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
