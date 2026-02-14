import { useState } from 'react';
import { Lock, Sparkles, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMode } from '@/contexts/ModeContext';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeModal from './UpgradeModal';

export default function ModeToggle() {
  const { mode, setMode } = useMode();
  const { isPremium } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleToggle = (target: 'simple' | 'advanced') => {
    if (target === mode) return;
    if (target === 'advanced' && !isPremium) {
      setShowUpgrade(true);
      return;
    }
    setMode(target);
  };

  return (
    <>
      <div className="relative flex items-center h-8 rounded-full bg-muted/60 border border-border/50 p-0.5">
        {/* Sliding indicator */}
        <div
          className={cn(
            'absolute h-7 rounded-full bg-primary transition-all duration-300 ease-out',
            mode === 'simple' ? 'left-0.5 w-[calc(50%-2px)]' : 'left-[50%] w-[calc(50%-2px)]'
          )}
        />
        
        <button
          onClick={() => handleToggle('simple')}
          className={cn(
            'relative z-10 flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium transition-colors',
            mode === 'simple' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <LayoutGrid className="h-3 w-3" />
          <span className="hidden sm:inline">Simple</span>
        </button>
        
        <button
          onClick={() => handleToggle('advanced')}
          className={cn(
            'relative z-10 flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium transition-colors',
            mode === 'advanced' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {!isPremium ? (
            <Lock className="h-3 w-3" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">AI Pro</span>
        </button>
      </div>

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </>
  );
}
