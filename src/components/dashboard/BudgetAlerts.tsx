import { AlertTriangle, TrendingUp, Bell } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Category } from '@/types/expense';
import { useExpenses } from '@/hooks/useExpenses';
import { format } from 'date-fns';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';

interface BudgetAlertsProps {
  categories: Category[];
  className?: string;
}

interface BudgetAlert {
  category: Category;
  spent: number;
  budget: number;
  percentage: number;
  isOverBudget: boolean;
}

export default function BudgetAlerts({ categories, className }: BudgetAlertsProps) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const { data: expenses = [] } = useExpenses({ month: currentMonth });

  // Calculate spending per category
  const categorySpending = expenses.reduce((acc, exp) => {
    if (exp.category_id) {
      acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  // Find categories that have exceeded their alert threshold
  const alerts: BudgetAlert[] = categories
    .filter((cat) => {
      if (!cat.monthly_budget || cat.monthly_budget <= 0) return false;
      const spent = categorySpending[cat.id] || 0;
      const threshold = cat.budget_alert_threshold ?? 80;
      const percentage = (spent / cat.monthly_budget) * 100;
      return percentage >= threshold;
    })
    .map((cat) => {
      const spent = categorySpending[cat.id] || 0;
      const budget = cat.monthly_budget!;
      const percentage = (spent / budget) * 100;
      return {
        category: cat,
        spent,
        budget,
        percentage,
        isOverBudget: percentage >= 100,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  if (alerts.length === 0) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Bell className="h-4 w-4" />
        <span>Budget Alerts</span>
      </div>
      
      <div className="space-y-2">
        {alerts.map((alert) => (
          <Alert
            key={alert.category.id}
            variant={alert.isOverBudget ? 'destructive' : 'default'}
            className={cn(
              'py-3 transition-all duration-200',
              !alert.isOverBudget && 'border-warning/50 bg-warning/10 text-warning-foreground [&>svg]:text-warning'
            )}
          >
            {alert.isOverBudget ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            <AlertTitle className="flex items-center gap-2 text-sm font-medium">
              <div
                className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                style={{ backgroundColor: alert.category.color + '30' }}
              >
                <DynamicIcon
                  name={alert.category.icon}
                  className="h-3 w-3"
                  style={{ color: alert.category.color }}
                />
              </div>
              {alert.category.name}
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {alert.isOverBudget ? (
                <>
                  You've spent <span className="font-semibold tabular-nums">{formatCurrency(alert.spent)}</span> — 
                  <span className="font-semibold"> {formatCurrency(alert.spent - alert.budget)}</span> over your {formatCurrency(alert.budget)} budget
                </>
              ) : (
                <>
                  You've used <span className="font-semibold tabular-nums">{alert.percentage.toFixed(0)}%</span> of your {formatCurrency(alert.budget)} budget 
                  (<span className="tabular-nums">{formatCurrency(alert.budget - alert.spent)}</span> remaining)
                </>
              )}
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}
