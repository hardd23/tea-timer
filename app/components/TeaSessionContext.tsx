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
  registerSessionResetHandler: (handler: () => void) => () => void;
  requestSessionReset: () => void;
}

const TeaSessionContext = createContext<TeaSessionContextValue | null>(null);

export function TeaSessionProvider({ children }: { children: ReactNode }) {
  const [isTeaCoolingTooLong, setIsTeaCoolingTooLong] = useState(false);
  const sessionResetHandlerRef = useRef<(() => void) | null>(null);

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
      registerSessionResetHandler,
      requestSessionReset,
    }),
    [isTeaCoolingTooLong, registerSessionResetHandler, requestSessionReset],
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
