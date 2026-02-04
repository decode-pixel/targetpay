import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/layout/AppLayout';
import StatCards from '@/components/dashboard/StatCards';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import CategoryBarChart from '@/components/dashboard/CategoryBarChart';
import MonthlyTrendChart from '@/components/dashboard/MonthlyTrendChart';
import MonthYearPicker from '@/components/dashboard/MonthYearPicker';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseFormDialog from '@/components/expenses/ExpenseFormDialog';
import { useExpenses } from '@/hooks/useExpenses';
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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Track your monthly expenses
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <MonthYearPicker 
              value={selectedMonth} 
              onChange={setSelectedMonth} 
            />
            <Button onClick={() => setExpenseDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Stats */}
        <StatCards selectedMonth={selectedMonth} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Expenses for {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy')}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/expenses')}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No expenses for this month
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
