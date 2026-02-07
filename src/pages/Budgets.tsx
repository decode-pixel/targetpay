import { useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Calendar, Info, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import MonthYearPicker from '@/components/dashboard/MonthYearPicker';
import MonthlyBudgetEditor from '@/components/categories/MonthlyBudgetEditor';
import BudgetHealthScore from '@/components/budget/BudgetHealthScore';
import BudgetSuggestions from '@/components/budget/BudgetSuggestions';
import FinancialSettingsCard from '@/components/budget/FinancialSettingsCard';
import CategoryTypeEditor from '@/components/budget/CategoryTypeEditor';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useBudgetRules } from '@/hooks/useBudgetRules';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Budgets() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses({ month: selectedMonth });
  const { healthMetrics, suggestions, categoryDetails } = useBudgetRules({ month: selectedMonth });

  // Calculate spending per category for the selected month
  const categorySpending = expenses.reduce((acc, exp) => {
    if (exp.category_id) {
      acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
    }
    return acc;
  }, {} as Record<string, number>);

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

  const isLoading = categoriesLoading || expensesLoading;
  const monthLabel = format(new Date(`${selectedMonth}-01`), 'MMMM yyyy');

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Budget Management</h1>
            <p className="text-sm text-muted-foreground">
              Smart budgeting with rule-based guidance
            </p>
          </div>
          <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* Tabs for different budget views */}
        <Tabs defaultValue="budgets" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="budgets" className="space-y-4">
            {/* Health Score & Suggestions Row */}
            {!isLoading && categories.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BudgetHealthScore metrics={healthMetrics} />
                <BudgetSuggestions 
                  suggestions={suggestions} 
                  month={selectedMonth} 
                />
              </div>
            )}

            {/* Info Alert */}
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Month-specific budgets</strong> override default category budgets for {monthLabel} only. 
                Changes here won't affect other months.
              </AlertDescription>
            </Alert>

            {/* Budget Cards */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No categories found. Create categories first to set budgets.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <MonthlyBudgetEditor
                    key={category.id}
                    category={category}
                    month={selectedMonth}
                    spent={categorySpending[category.id] || 0}
                  />
                ))}
              </div>
            )}

            {/* Summary Card */}
            {!isLoading && categories.length > 0 && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {monthLabel} Summary
                  </CardTitle>
                  <CardDescription>
                    Budget overview for the selected month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Categories</p>
                      <p className="text-lg font-semibold">{categories.length}</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">With Budget</p>
                      <p className="text-lg font-semibold">
                        {categories.filter(c => c.monthly_budget && c.monthly_budget > 0).length}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                      <p className="text-lg font-semibold">{expenses.length}</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                      <p className="text-lg font-semibold text-destructive">
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          minimumFractionDigits: 0,
                        }).format(expenses.reduce((sum, e) => sum + Number(e.amount), 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategoryTypeEditor categories={categories} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <FinancialSettingsCard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
