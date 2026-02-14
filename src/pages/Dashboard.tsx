import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/layout/AppLayout';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import CategoryBarChart from '@/components/dashboard/CategoryBarChart';
import MonthlyTrendChart from '@/components/dashboard/MonthlyTrendChart';
import BudgetAlerts from '@/components/dashboard/BudgetAlerts';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseFormDialog from '@/components/expenses/ExpenseFormDialog';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { Expense } from '@/types/expense';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { isSimple, isAdvanced, setMode } = useMode();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const { data: expenses = [], isLoading } = useExpenses({ month: selectedMonth });
  const { data: categories = [] } = useCategories();

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/expenses?category=${categoryId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Sticky Dashboard Header */}
        <DashboardHeader 
          selectedMonth={selectedMonth} 
          onMonthChange={setSelectedMonth} 
        />

        {/* Budget Alerts */}
        <BudgetAlerts categories={categories} selectedMonth={selectedMonth} />

        {/* Charts - Advanced only */}
        {isAdvanced && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <CategoryPieChart 
                selectedMonth={selectedMonth} 
                onCategoryClick={handleCategoryClick}
              />
              <CategoryBarChart selectedMonth={selectedMonth} />
            </div>
            <MonthlyTrendChart />
          </>
        )}

        {/* Recent Expenses */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between py-3 md:py-4">
            <CardTitle className="text-base md:text-lg">
              Recent Expenses
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/expenses')}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent className="pt-0 px-3 md:px-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No expenses this month
              </div>
            ) : (
              <ExpenseList 
                expenses={expenses.slice(0, 5)} 
                onEdit={handleEditExpense}
              />
            )}
          </CardContent>
        </Card>

        {/* Simple Mode Upgrade Banner */}
        {isSimple && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Want AI-powered insights?</p>
                    <p className="text-xs text-muted-foreground">
                      Switch to AI Pro mode for smart budgeting, suggestions & more — it's free!
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setMode('advanced')} className="shrink-0">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Try AI Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Expense Form Dialog */}
      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={(open) => {
          setExpenseDialogOpen(open);
          if (!open) setEditingExpense(null);
        }}
        expense={editingExpense}
      />
    </AppLayout>
  );
}
