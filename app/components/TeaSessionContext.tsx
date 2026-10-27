'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

interface TeaSessionContextValue {
  isTeaCoolingTooLong: boolean;
  setIsTeaCoolingTooLong: Dispatch<SetStateAction<boolean>>;
  pourCount: number;
  adjustPourCount: (amount: number) => void;
  resetPourCount: () => void;
  registerSessionResetHandler: (handler: () => void) => () => void;
  requestSessionReset: () => void;
}

const TeaSessionContext = createContext<TeaSessionContextValue | null>(null);

export function TeaSessionProvider({ children }: { children: ReactNode }) {
  const [isTeaCoolingTooLong, setIsTeaCoolingTooLong] = useState(false);
  const [pourCount, setPourCount] = useState(0);
  const sessionResetHandlerRef = useRef<(() => void) | null>(null);

  const adjustPourCount = useCallback((amount: number) => {
    setPourCount((currentCount) => Math.min(99, Math.max(0, currentCount + amount)));
  }, []);

  const resetPourCount = useCallback(() => setPourCount(0), []);

  const registerSessionResetHandler = useCallback((handler: () => void) => {
    sessionResetHandlerRef.current = handler;

    return () => {
      if (sessionResetHandlerRef.current === handler) {
        sessionResetHandlerRef.current = null;
      }
    };
  }, []);

  const requestSessionReset = useCallback(() => {
    sessionResetHandlerRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      isTeaCoolingTooLong,
      setIsTeaCoolingTooLong,
      pourCount,
      adjustPourCount,
      resetPourCount,
      registerSessionResetHandler,
      requestSessionReset,
    }),
    [
      adjustPourCount,
      isTeaCoolingTooLong,
      pourCount,
      registerSessionResetHandler,
      requestSessionReset,
      resetPourCount,
    ],
  );

  return (
    <TeaSessionContext.Provider value={value}>
      {children}
    </TeaSessionContext.Provider>
  );
}

export function useTeaSession() {
  const context = useContext(TeaSessionContext);

  if (!context) {
    throw new Error('useTeaSession must be used within TeaSessionProvider');
  }

  return context;
}
