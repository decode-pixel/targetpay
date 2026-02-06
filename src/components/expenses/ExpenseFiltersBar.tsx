import { useState } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Filter, Search, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { ExpenseFilters, PaymentMethod, PAYMENT_METHODS } from '@/types/expense';
import { useCategories } from '@/hooks/useCategories';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ExpenseFiltersBarProps {
  filters: ExpenseFilters;
  onFiltersChange: (filters: ExpenseFilters) => void;
}

export default function ExpenseFiltersBar({ filters, onFiltersChange }: ExpenseFiltersBarProps) {
  const { data: categories = [] } = useCategories();
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useIsMobile();

  const currentMonth = filters.month || format(new Date(), 'yyyy-MM');
  const monthDate = new Date(currentMonth + '-01');

  const handlePrevMonth = () => {
    const prevMonth = subMonths(monthDate, 1);
    onFiltersChange({ ...filters, month: format(prevMonth, 'yyyy-MM') });
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(monthDate, 1);
    onFiltersChange({ ...filters, month: format(nextMonth, 'yyyy-MM') });
  };

  const handleCategoryChange = (value: string) => {
    onFiltersChange({
      ...filters,
      categoryId: value === 'all' ? undefined : value,
    });
  };

  const handlePaymentMethodChange = (value: string) => {
    onFiltersChange({
      ...filters,
      paymentMethod: value === 'all' ? undefined : (value as PaymentMethod),
    });
  };

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      search: value || undefined,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      month: filters.month,
    });
  };

  const activeFilterCount = [
    filters.categoryId,
    filters.paymentMethod,
    filters.search,
  ].filter(Boolean).length;

  const filterContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Filters</h4>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Search - always visible in drawer/popover */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <Input
          placeholder="Search notes..."
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-11"
        />
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select
          value={filters.categoryId || 'all'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payment Method Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Payment Method</label>
        <Select
          value={filters.paymentMethod || 'all'}
          onValueChange={handlePaymentMethodChange}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="All methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {PAYMENT_METHODS.map((method) => (
              <SelectItem key={method.value} value={method.value}>
                {method.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 md:gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handlePrevMonth}
            className="h-9 w-9 md:h-10 md:w-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm md:text-base min-w-[120px] md:min-w-[140px] text-center">
            {format(monthDate, isMobile ? 'MMM yyyy' : 'MMMM yyyy')}
          </span>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleNextMonth}
            className="h-9 w-9 md:h-10 md:w-10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search - desktop only */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              className="pl-9 w-[200px]"
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Filter Button - Mobile uses Drawer, Desktop uses Popover */}
          {isMobile ? (
            <Drawer open={showFilters} onOpenChange={setShowFilters}>
              <DrawerTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "gap-2 h-9",
                    activeFilterCount > 0 && "border-primary"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-5 w-5 p-0 justify-center text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Filters</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-6">
                  {filterContent}
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                {filterContent}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.categoryId && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {categories.find(c => c.id === filters.categoryId)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, categoryId: undefined })}
              />
            </Badge>
          )}
          {filters.paymentMethod && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {PAYMENT_METHODS.find(m => m.value === filters.paymentMethod)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, paymentMethod: undefined })}
              />
            </Badge>
          )}
          {filters.search && (
            <Badge variant="secondary" className="gap-1 text-xs">
              "{filters.search}"
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFiltersChange({ ...filters, search: undefined })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
