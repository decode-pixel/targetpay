import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Mode = 'simple' | 'advanced';

interface ModeContextType {
  mode: Mode;
  isSimple: boolean;
  isAdvanced: boolean;
  toggleMode: () => void;
  setMode: (mode: Mode) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    return (localStorage.getItem('app_mode') as Mode) || 'simple';
  });

  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);
    localStorage.setItem('app_mode', newMode);
  }, []);

  const toggleMode = useCallback(() => {
    const newMode = mode === 'simple' ? 'advanced' : 'simple';
    setMode(newMode);
  }, [mode, setMode]);

  return (
    <ModeContext.Provider value={{
      mode,
      isSimple: mode === 'simple',
      isAdvanced: mode === 'advanced',
      toggleMode,
      setMode,
    }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) throw new Error('useMode must be used within ModeProvider');
  return context;
}
