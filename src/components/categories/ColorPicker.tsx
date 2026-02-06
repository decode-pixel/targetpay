import { CATEGORY_COLORS } from '@/types/expense';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(
            'h-11 w-full rounded-lg transition-all duration-150',
            'touch-manipulation active:scale-95 flex items-center justify-center',
            'border-2',
            value === c 
              ? 'border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground/20 scale-105' 
              : 'border-transparent hover:scale-105'
          )}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        >
          {value === c && (
            <Check className="h-5 w-5 text-white drop-shadow-md" />
          )}
        </button>
      ))}
    </div>
  );
}
