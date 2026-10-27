'use client';

import { type ReactNode, type RefObject, useEffect, useRef } from 'react';

interface AppDialogProps {
  children: ReactNode;
  closeLabel: string;
  contentClassName?: string;
  id: string;
  isOpen: boolean;
  labelledBy: string;
  onRequestClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export default function AppDialog({
  children,
  closeLabel,
  contentClassName = '',
  id,
  isOpen,
  labelledBy,
  onRequestClose,
  returnFocusRef,
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      wasOpenRef.current = true;
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }

    if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
    }
  }, [isOpen, returnFocusRef]);

  return (
    <dialog
      id={id}
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        dialogRef.current?.close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      onClose={onRequestClose}
    >
      <section className={`app-dialog-panel ${contentClassName}`.trim()}>
        <button
          type="button"
          className="app-dialog-close"
          onClick={() => dialogRef.current?.close()}
          aria-label={closeLabel}
          autoFocus
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </section>
    </dialog>
  );
}
