import { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface StatCardsProps {
  selectedMonth: string;
}

export default function StatCards({ selectedMonth }: StatCardsProps) {
  const { data: expenses = [] } = useExpenses({ month: selectedMonth });
  const { data: categories = [] } = useCategories();

  const stats = useMemo(() => {
    const totalExpense = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    
    const categorySpending = expenses.reduce((acc, exp) => {
      if (exp.category_id) {
        acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    const totalBudget = categories.reduce((sum, cat) => sum + (Number(cat.monthly_budget) || 0), 0);
    const remainingBudget = totalBudget - totalExpense;
    const budgetPercentage = totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0;

    let highestCategory = null;
    let highestAmount = 0;
    Object.entries(categorySpending).forEach(([catId, amount]) => {
      if (amount > highestAmount) {
        highestAmount = amount;
        const cat = categories.find(c => c.id === catId);
        if (cat) {
          highestCategory = { name: cat.name, amount, color: cat.color };
        }
      }
    });

    return {
      totalExpense,
      totalBudget,
      remainingBudget,
      budgetPercentage,
      highestCategory,
      transactionCount: expenses.length,
    };
  }, [expenses, categories]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Expenses */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Expenses
          </CardTitle>
          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-destructive" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatCurrency(stats.totalExpense)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.transactionCount} transactions
          </p>
        </CardContent>
      </Card>

      {/* Remaining Budget */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Remaining Budget
          </CardTitle>
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center",
            stats.remainingBudget >= 0 ? "bg-success/10" : "bg-destructive/10"
          )}>
            <PiggyBank className={cn(
              "h-4 w-4",
              stats.remainingBudget >= 0 ? "text-success" : "text-destructive"
            )} />
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold tabular-nums",
            stats.remainingBudget < 0 && "text-destructive"
          )}>
            {formatCurrency(stats.remainingBudget)}
          </div>
          <div className="mt-2">
            <Progress 
              value={Math.min(stats.budgetPercentage, 100)} 
              className="h-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {stats.budgetPercentage.toFixed(0)}% of budget used
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Total Budget */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Monthly Budget
          </CardTitle>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatCurrency(stats.totalBudget)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {categories.length} categories
          </p>
        </CardContent>
      </Card>

      {/* Highest Spending */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Category
          </CardTitle>
          <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-warning" />
          </div>
        </CardHeader>
        <CardContent>
          {stats.highestCategory ? (
            <>
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(stats.highestCategory.amount)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: stats.highestCategory.color }}
                />
                <p className="text-xs text-muted-foreground">
                  {stats.highestCategory.name}
                </p>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">No expenses yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
