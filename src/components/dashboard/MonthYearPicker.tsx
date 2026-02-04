import { useState } from 'react';
import { format, addMonths, subMonths, setMonth, setYear } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MonthYearPickerProps {
  value: string; // format: 'yyyy-MM'
  onChange: (value: string) => void;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function MonthYearPicker({ value, onChange }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const currentDate = value ? new Date(`${value}-01`) : new Date();
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  
  const selectedMonth = currentDate.getMonth();
  const selectedYear = currentDate.getFullYear();

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(setYear(new Date(), viewYear), monthIndex);
    onChange(format(newDate, 'yyyy-MM'));
    setOpen(false);
  };

  const handlePrevMonth = () => {
    const newDate = subMonths(currentDate, 1);
    onChange(format(newDate, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const newDate = addMonths(currentDate, 1);
    onChange(format(newDate, 'yyyy-MM'));
  };

  const handlePrevYear = () => {
    setViewYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setViewYear(prev => prev + 1);
  };

  const isCurrentMonth = (monthIndex: number) => {
    return monthIndex === selectedMonth && viewYear === selectedYear;
  };

  const isFutureMonth = (monthIndex: number) => {
    const now = new Date();
    return viewYear > now.getFullYear() || 
      (viewYear === now.getFullYear() && monthIndex > now.getMonth());
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={handlePrevMonth}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="min-w-[160px] justify-center gap-2 font-medium"
          >
            <Calendar className="h-4 w-4" />
            {format(currentDate, 'MMMM yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-4" align="center">
          {/* Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevYear}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-lg">{viewYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextYear}
              disabled={viewYear >= new Date().getFullYear()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((month, index) => (
              <Button
                key={month}
                variant={isCurrentMonth(index) ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-10',
                  isCurrentMonth(index) && 'bg-primary text-primary-foreground',
                  isFutureMonth(index) && 'text-muted-foreground opacity-50'
                )}
                onClick={() => handleMonthSelect(index)}
                disabled={isFutureMonth(index)}
              >
                {month}
              </Button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-border flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                const now = new Date();
                onChange(format(now, 'yyyy-MM'));
                setViewYear(now.getFullYear());
                setOpen(false);
              }}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                const lastMonth = subMonths(new Date(), 1);
                onChange(format(lastMonth, 'yyyy-MM'));
                setViewYear(lastMonth.getFullYear());
                setOpen(false);
              }}
            >
              Last Month
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={handleNextMonth}
        disabled={format(addMonths(currentDate, 1), 'yyyy-MM') > format(new Date(), 'yyyy-MM')}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
