import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingAddButtonProps {
  onClick: () => void;
  className?: string;
}

export default function FloatingAddButton({ onClick, className }: FloatingAddButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        'fixed z-40 h-14 w-14 rounded-full shadow-elevated',
        'bg-gradient-primary hover:opacity-90 transition-all duration-200',
        'active:scale-95 touch-manipulation',
        // Position above bottom nav on mobile, bottom-right on desktop
        'right-4 bottom-20 md:bottom-6',
        className
      )}
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">Add new</span>
    </Button>
  );
}
