import { CATEGORY_ICONS } from '@/types/expense';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
}

export default function IconPicker({ value, onChange, color = '#3B82F6' }: IconPickerProps) {
  return (
    <ScrollArea className="h-[180px] w-full">
      <div className="grid grid-cols-6 gap-2 p-1">
        {CATEGORY_ICONS.map((iconName) => (
          <button
            key={iconName}
            type="button"
            onClick={() => onChange(iconName)}
            className={cn(
              'h-11 w-11 flex items-center justify-center rounded-lg transition-all duration-150',
              'touch-manipulation active:scale-95',
              'border-2',
              value === iconName
                ? 'border-primary bg-primary/10 scale-105'
                : 'border-transparent bg-muted hover:bg-muted/80'
            )}
            style={value === iconName ? { borderColor: color, backgroundColor: color + '20' } : {}}
          >
            <DynamicIcon 
              name={iconName} 
              className="h-5 w-5" 
              style={value === iconName ? { color } : {}}
            />
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
