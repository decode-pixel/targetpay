import { useMemo } from 'react';
import { format } from 'date-fns';
import { TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import MonthYearPicker from './MonthYearPicker';

interface DashboardHeaderProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export default function DashboardHeader({ selectedMonth, onMonthChange }: DashboardHeaderProps) {
  const { data: expenses = [] } = useExpenses({ month: selectedMonth });
  const { data: categories = [] } = useCategories();

  const stats = useMemo(() => {
    const totalExpense = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const totalBudget = categories.reduce((sum, cat) => sum + (Number(cat.monthly_budget) || 0), 0);
    const remainingBudget = totalBudget - totalExpense;
    const budgetPercentage = totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0;

    return {
      totalExpense,
      totalBudget,
      remainingBudget,
      budgetPercentage,
      transactionCount: expenses.length,
    };
  }, [expenses, categories]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const isOverBudget = stats.remainingBudget < 0;
  const monthLabel = format(new Date(`${selectedMonth}-01`), 'MMMM yyyy');

  return (
    <div className="sticky top-14 md:top-16 z-40 -mx-4 px-4 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/50">
      <div className="space-y-4">
        {/* Top row: Month picker */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold">{monthLabel}</h1>
            <p className="text-xs text-muted-foreground">
              {stats.transactionCount} transaction{stats.transactionCount !== 1 ? 's' : ''}
            </p>
          </div>
          <MonthYearPicker value={selectedMonth} onChange={onMonthChange} />
        </div>

        {/* Stats cards - horizontal scroll on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {/* Total Spent */}
          <div className="flex-shrink-0 min-w-[140px] bg-destructive/10 rounded-xl p-3 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Spent</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-destructive">
              {formatCurrency(stats.totalExpense)}
            </p>
          </div>

          {/* Total Budget */}
          <div className="flex-shrink-0 min-w-[140px] bg-primary/10 rounded-xl p-3 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Budget</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-primary">
              {formatCurrency(stats.totalBudget)}
            </p>
          </div>

          {/* Remaining */}
          <div className={cn(
            "flex-shrink-0 min-w-[140px] rounded-xl p-3 border",
            isOverBudget 
              ? "bg-destructive/10 border-destructive/20" 
              : "bg-success/10 border-success/20"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className={cn(
                "h-4 w-4",
                isOverBudget ? "text-destructive" : "text-success"
              )} />
              <span className="text-xs text-muted-foreground">
                {isOverBudget ? 'Over' : 'Left'}
              </span>
            </div>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              isOverBudget ? "text-destructive" : "text-success"
            )}>
              {isOverBudget ? '-' : ''}{formatCurrency(stats.remainingBudget)}
            </p>
          </div>
        </div>

        {/* Budget progress */}
        {stats.totalBudget > 0 && (
          <div className="space-y-1.5">
            <Progress 
              value={Math.min(stats.budgetPercentage, 100)} 
              className={cn(
                "h-2",
                isOverBudget && "[&>div]:bg-destructive"
              )}
            />
            <p className="text-xs text-muted-foreground text-center">
              {stats.budgetPercentage.toFixed(0)}% of monthly budget used
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
