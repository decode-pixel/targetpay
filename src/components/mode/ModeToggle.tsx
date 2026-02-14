import { LayoutGrid, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMode } from '@/contexts/ModeContext';

export default function ModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <div className="relative flex items-center h-8 rounded-full bg-muted/60 border border-border/50 p-0.5">
      {/* Sliding indicator */}
      <div
        className={cn(
          'absolute h-7 rounded-full bg-primary transition-all duration-300 ease-out',
          mode === 'simple' ? 'left-0.5 w-[calc(50%-2px)]' : 'left-[50%] w-[calc(50%-2px)]'
        )}
      />
      
      <button
        onClick={() => setMode('simple')}
        className={cn(
          'relative z-10 flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium transition-colors',
          mode === 'simple' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <LayoutGrid className="h-3 w-3" />
        <span className="hidden sm:inline">Simple</span>
      </button>
      
      <button
        onClick={() => setMode('advanced')}
        className={cn(
          'relative z-10 flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium transition-colors',
          mode === 'advanced' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">AI Pro</span>
      </button>
    </div>
  );
}
