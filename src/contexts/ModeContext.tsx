import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

type Mode = 'simple' | 'advanced';

interface ModeContextType {
  mode: Mode;
  isSimple: boolean;
  isAdvanced: boolean;
  toggleMode: () => boolean; // returns false if blocked (not premium)
  setMode: (mode: Mode) => boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const { isPremium } = useSubscription();
  
  const [mode, setModeState] = useState<Mode>(() => {
    return (localStorage.getItem('app_mode') as Mode) || 'simple';
  });

  const setMode = useCallback((newMode: Mode): boolean => {
    if (newMode === 'advanced' && !isPremium) {
      return false; // blocked
    }
    setModeState(newMode);
    localStorage.setItem('app_mode', newMode);
    return true;
  }, [isPremium]);

  const toggleMode = useCallback((): boolean => {
    const newMode = mode === 'simple' ? 'advanced' : 'simple';
    return setMode(newMode);
  }, [mode, setMode]);

  // If user loses premium, revert to simple
  if (mode === 'advanced' && !isPremium) {
    setModeState('simple');
    localStorage.setItem('app_mode', 'simple');
  }

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
