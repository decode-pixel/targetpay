import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Loader2 } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { user, loading } = useAuth();
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

        {/* Budget Alerts - now month-aware */}
        <BudgetAlerts categories={categories} selectedMonth={selectedMonth} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <CategoryPieChart 
            selectedMonth={selectedMonth} 
            onCategoryClick={handleCategoryClick}
          />
          <CategoryBarChart selectedMonth={selectedMonth} />
        </div>

        {/* Trend Chart */}
        <MonthlyTrendChart />

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
