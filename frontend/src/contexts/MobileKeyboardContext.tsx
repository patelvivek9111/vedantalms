import React, { createContext, useContext } from 'react';
import { useVirtualKeyboardOpen } from '../hooks/useVirtualKeyboardOpen';

const MobileKeyboardContext = createContext(false);

export function MobileKeyboardProvider({ children }: { children: React.ReactNode }) {
  const keyboardOpen = useVirtualKeyboardOpen();
  return (
    <MobileKeyboardContext.Provider value={keyboardOpen}>
      {children}
    </MobileKeyboardContext.Provider>
  );
}

export function useMobileKeyboardOpen(): boolean {
  return useContext(MobileKeyboardContext);
}
