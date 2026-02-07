import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { CATEGORY_ICONS } from '@/types/expense';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
}

// Group icons by category for easier browsing
const ICON_GROUPS: Record<string, string[]> = {
  'Popular': ['utensils', 'car', 'shopping-bag', 'receipt', 'home', 'wallet', 'heart-pulse', 'graduation-cap'],
  'Food': ['utensils', 'coffee', 'pizza', 'sandwich', 'apple', 'beer', 'wine', 'cookie'],
  'Transport': ['car', 'bus', 'train', 'plane', 'bike', 'fuel', 'car-taxi-front'],
  'Shopping': ['shopping-bag', 'shopping-cart', 'shirt', 'gem', 'gift', 'package'],
  'Entertainment': ['gamepad-2', 'music', 'tv', 'film', 'ticket', 'popcorn'],
  'Bills': ['receipt', 'file-text', 'zap', 'droplet', 'wifi', 'phone', 'lightbulb'],
  'Health': ['heart-pulse', 'pill', 'stethoscope', 'activity', 'thermometer'],
  'Education': ['graduation-cap', 'book', 'book-open', 'library', 'pen-tool'],
  'Home': ['home', 'sofa', 'lamp', 'key', 'wrench', 'paint-bucket'],
  'Finance': ['wallet', 'credit-card', 'banknote', 'piggy-bank', 'trending-up', 'landmark'],
  'Work': ['briefcase', 'laptop', 'monitor', 'printer', 'headphones'],
  'Travel': ['map', 'compass', 'tent', 'umbrella', 'camera', 'luggage'],
  'Other': ['more-horizontal', 'star', 'tag', 'flag', 'bookmark', 'repeat', 'cloud'],
};

export default function IconPicker({ value, onChange, color = '#3B82F6' }: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return CATEGORY_ICONS;
    }
    const query = searchQuery.toLowerCase();
    return CATEGORY_ICONS.filter(icon => icon.toLowerCase().includes(query));
  }, [searchQuery]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <ScrollArea className="h-[200px] w-full">
        <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 p-1">
          {filteredIcons.map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={cn(
                'aspect-square flex items-center justify-center rounded-lg transition-all duration-150',
                'touch-manipulation active:scale-95',
                'border-2',
                value === iconName
                  ? 'border-primary bg-primary/10 scale-105'
                  : 'border-transparent bg-muted hover:bg-muted/80'
              )}
              style={value === iconName ? { borderColor: color, backgroundColor: color + '20' } : {}}
              title={iconName}
            >
              <DynamicIcon 
                name={iconName} 
                className="h-4 w-4 sm:h-5 sm:w-5" 
                style={value === iconName ? { color } : {}}
              />
            </button>
          ))}
        </div>
        
        {filteredIcons.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No icons found
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
