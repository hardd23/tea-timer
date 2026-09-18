'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react';

interface TeaSessionContextValue {
  isTeaCoolingTooLong: boolean;
  setIsTeaCoolingTooLong: Dispatch<SetStateAction<boolean>>;
}

const TeaSessionContext = createContext<TeaSessionContextValue | null>(null);

export function TeaSessionProvider({ children }: { children: ReactNode }) {
  const [isTeaCoolingTooLong, setIsTeaCoolingTooLong] = useState(false);
  const value = useMemo(
    () => ({ isTeaCoolingTooLong, setIsTeaCoolingTooLong }),
    [isTeaCoolingTooLong],
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
