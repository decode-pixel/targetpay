import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2, Calendar, Info, Settings, Zap, ZapOff, Plus, Shield, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import MonthYearPicker from '@/components/dashboard/MonthYearPicker';
import MonthlyBudgetEditor from '@/components/categories/MonthlyBudgetEditor';
import BudgetHealthScore from '@/components/budget/BudgetHealthScore';
import BudgetSuggestions from '@/components/budget/BudgetSuggestions';
import FinancialSettingsCard from '@/components/budget/FinancialSettingsCard';
import CategoryTypeEditor from '@/components/budget/CategoryTypeEditor';
import CategoryFormDialog from '@/components/categories/CategoryFormDialog';
import FloatingAddButton from '@/components/layout/FloatingAddButton';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { useCategories } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import { useBudgetRules } from '@/hooks/useBudgetRules';
import { useFinancialSettings } from '@/hooks/useFinancialSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Category } from '@/types/expense';
import { BudgetMode } from '@/types/budget';
import { cn } from '@/lib/utils';

const MODE_BANNER: Record<BudgetMode, { icon: React.ReactNode; color: string; bg: string; description: string }> = {
  flexible: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    description: 'No restrictions — tips and suggestions only',
  },
  guided: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    description: 'Warnings shown when budget rules are violated',
  },
  strict: {
    icon: <Lock className="h-4 w-4" />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    description: 'Override required for over-budget spending, allocation locked to 50/30/20',
  },
};

export default function Budgets() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isSimple, isAdvanced } = useMode();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses({ month: selectedMonth });
  const { data: financialSettings } = useFinancialSettings();
  const { healthMetrics, suggestions, categoryDetails, budgetMode } = useBudgetRules({ month: selectedMonth });

  const smartRulesEnabled = isAdvanced && (financialSettings?.smart_rules_enabled ?? true);

  const categorySpending = expenses.reduce((acc, exp) => {
    if (exp.category_id) {
      acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const isLoading = categoriesLoading || expensesLoading;
  const monthLabel = format(new Date(`${selectedMonth}-01`), 'MMMM yyyy');
  const banner = MODE_BANNER[budgetMode];

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                {isSimple ? 'Budgets' : 'Budget Management'}
                {isAdvanced && smartRulesEnabled && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary font-normal">
                    <Zap className="h-3 w-3 mr-1" />
                    Smart
                  </Badge>
                )}
                {isAdvanced && !smartRulesEnabled && (
                  <Badge variant="secondary" className="bg-muted font-normal">
                    <ZapOff className="h-3 w-3 mr-1" />
                    Simple
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isSimple
                  ? 'Set monthly budgets for your categories'
                  : smartRulesEnabled 
                    ? 'Rule-based budgeting with AI suggestions' 
                    : 'Manual budgets with full control'}
              </p>
            </div>
          </div>
          <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* Mode Banner - shown in advanced mode with smart rules */}
        {isAdvanced && smartRulesEnabled && (
          <Alert className={cn('border', banner.bg)}>
            <div className={cn('flex items-center gap-2', banner.color)}>
              {banner.icon}
              <span className="font-semibold capitalize">{budgetMode} Mode</span>
            </div>
            <AlertDescription className="text-xs mt-1">
              {banner.description}
            </AlertDescription>
          </Alert>
        )}

        {isSimple ? (
          /* Simple Mode */
          <div className="space-y-4">
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Simple Mode:</strong> Set manual budgets for each category.
              </AlertDescription>
            </Alert>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    No categories found. Create your first category to start budgeting.
                  </p>
                  <Button onClick={handleAddCategory} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Category
                  </Button>
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

            {/* Summary */}
            {!isLoading && categories.length > 0 && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {monthLabel} Summary
                  </CardTitle>
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
          </div>
        ) : (
          /* Advanced Mode */
          <Tabs defaultValue="budgets" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="budgets">Budgets</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="budgets" className="space-y-4">
              {smartRulesEnabled && !isLoading && categories.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <BudgetHealthScore metrics={healthMetrics} budgetMode={budgetMode} />
                  <BudgetSuggestions suggestions={suggestions} month={selectedMonth} />
                </div>
              )}

              <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {smartRulesEnabled ? (
                    <>
                      <strong>Month-specific budgets</strong> override default category budgets for {monthLabel} only. 
                      AI suggestions respect your manual settings.
                    </>
                  ) : (
                    <>
                      <strong>Simple Mode:</strong> Set manual budgets for each category. 
                      Enable Smart Rules in Settings for AI-powered suggestions.
                    </>
                  )}
                </AlertDescription>
              </Alert>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : categories.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      No categories found. Create your first category to start budgeting.
                    </p>
                    <Button onClick={handleAddCategory} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Category
                    </Button>
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

              {!isLoading && categories.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {monthLabel} Summary
                    </CardTitle>
                    <CardDescription>Budget overview for the selected month</CardDescription>
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
              {!isMobile && (
                <div className="flex justify-end">
                  <Button onClick={handleAddCategory} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Category
                  </Button>
                </div>
              )}

              <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {smartRulesEnabled ? (
                    <>
                      <strong>Smart Mode:</strong> Create categories with custom icons, colors, and budgets. 
                      AI will suggest improvements but never overwrite your settings.
                    </>
                  ) : (
                    <>
                      <strong>Simple Mode:</strong> Create and manage categories manually. 
                      Set optional budgets for each category.
                    </>
                  )}
                </AlertDescription>
              </Alert>

              {smartRulesEnabled && categories.length > 0 && (
                <CategoryTypeEditor categories={categories} />
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : categories.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground mb-4">
                      No categories yet. Create your first category to organize expenses.
                    </p>
                    <Button onClick={handleAddCategory} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Category
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map((category) => (
                    <Card 
                      key={category.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleEditCategory(category)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: category.color + '20' }}
                          >
                            <DynamicIcon 
                              name={category.icon} 
                              className="h-5 w-5" 
                              style={{ color: category.color }} 
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{category.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {category.monthly_budget 
                                ? `₹${category.monthly_budget.toLocaleString('en-IN')} budget` 
                                : 'No budget set'}
                            </p>
                          </div>
                          {smartRulesEnabled && category.category_type && (
                            <Badge variant="outline" className="text-xs capitalize shrink-0">
                              {category.category_type}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <FinancialSettingsCard />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {isMobile && (
        <FloatingAddButton onClick={handleAddCategory} />
      )}

      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
      />
    </AppLayout>
  );
}
