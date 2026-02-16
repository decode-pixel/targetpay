import { AlertTriangle, TrendingUp, Bell, OctagonAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Category } from '@/types/expense';
import { useExpenses } from '@/hooks/useExpenses';
import { useAllEffectiveBudgets } from '@/hooks/useCategoryBudgets';
import { useFinancialSettings } from '@/hooks/useFinancialSettings';
import { format } from 'date-fns';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';
import { BudgetMode } from '@/types/budget';

interface BudgetAlertsProps {
  categories: Category[];
  className?: string;
  selectedMonth?: string;
}

interface BudgetAlert {
  category: Category;
  spent: number;
  budget: number;
  percentage: number;
  isOverBudget: boolean;
}

export default function BudgetAlerts({ categories, className, selectedMonth }: BudgetAlertsProps) {
  const month = selectedMonth || format(new Date(), 'yyyy-MM');
  const { data: expenses = [] } = useExpenses({ month });
  const { data: financialSettings } = useFinancialSettings();
  const { budgets: effectiveBudgets } = useAllEffectiveBudgets(month, categories);

  const budgetMode: BudgetMode = financialSettings?.budget_mode || 'flexible';

  const categorySpending = expenses.reduce((acc, exp) => {
    if (exp.category_id) {
      acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  // Mode-aware threshold
  const getAlertThreshold = (cat: Category) => {
    if (budgetMode === 'flexible') return 100; // Only show when over budget
    if (budgetMode === 'strict') return 50; // Early warnings
    return cat.budget_alert_threshold ?? 80; // Guided uses configured threshold
  };

  const alerts: BudgetAlert[] = categories
    .filter((cat) => {
      const budget = effectiveBudgets.get(cat.id) || 0;
      if (budget <= 0) return false;
      const spent = categorySpending[cat.id] || 0;
      const threshold = getAlertThreshold(cat);
      const percentage = (spent / budget) * 100;
      return percentage >= threshold;
    })
    .map((cat) => {
      const spent = categorySpending[cat.id] || 0;
      const budget = effectiveBudgets.get(cat.id) || 0;
      const percentage = budget > 0 ? (spent / budget) * 100 : 0;
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
        {alerts.map((alert) => {
          const isViolation = budgetMode === 'strict' && alert.isOverBudget;
          
          return (
            <Alert
              key={alert.category.id}
              variant={alert.isOverBudget ? 'destructive' : 'default'}
              className={cn(
                'py-3 transition-all duration-200',
                !alert.isOverBudget && 'border-warning/50 bg-warning/10 text-warning-foreground [&>svg]:text-warning',
                isViolation && 'animate-pulse'
              )}
            >
              {isViolation ? (
                <OctagonAlert className="h-4 w-4" />
              ) : alert.isOverBudget ? (
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
                {isViolation && (
                  <span className="text-xs font-bold uppercase tracking-wider">
                    VIOLATION
                  </span>
                )}
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {alert.isOverBudget ? (
                  <>
                    {budgetMode === 'strict' ? 'Budget violated! ' : ''}
                    You've spent <span className="font-semibold tabular-nums">{formatCurrency(alert.spent)}</span> — 
                    <span className="font-semibold"> {formatCurrency(alert.spent - alert.budget)}</span> over your {formatCurrency(alert.budget)} budget
                  </>
                ) : (
                  <>
                    You've used <span className="font-semibold tabular-nums">{alert.percentage.toFixed(0)}%</span> of your {formatCurrency(alert.budget)} budget 
                    (<span className="tabular-nums">{formatCurrency(alert.budget - alert.spent)}</span> remaining)
                    {budgetMode === 'strict' && alert.percentage >= 80 && (
                      <span className="font-semibold"> — approaching limit!</span>
                    )}
                  </>
                )}
              </AlertDescription>
            </Alert>
          );
        })}
      </div>
    </div>
  );
}
