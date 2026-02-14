import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Loader2, Download, Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AppLayout from '@/components/layout/AppLayout';
import FloatingAddButton from '@/components/layout/FloatingAddButton';
import ExpenseList from '@/components/expenses/ExpenseList';
import ExpenseFormDialog from '@/components/expenses/ExpenseFormDialog';
import ExpenseFiltersBar from '@/components/expenses/ExpenseFiltersBar';
import ImportWizardDialog from '@/components/import/ImportWizardDialog';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';
import { Expense, ExpenseFilters } from '@/types/expense';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { exportExpensesToCSV, exportExpensesSummaryToCSV } from '@/lib/exportCSV';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Expenses() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isAdvanced } = useMode();
  const [searchParams] = useSearchParams();
  
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({
    month: format(new Date(), 'yyyy-MM'),
  });

  // Apply URL params to filters
  useEffect(() => {
    const categoryId = searchParams.get('category');
    if (categoryId) {
      setFilters(prev => ({ ...prev, categoryId }));
    }
  }, [searchParams]);

  const { data: expenses = [], isLoading } = useExpenses(filters);
  const { data: categories = [] } = useCategories();

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      toast.error('No expenses to export');
      return;
    }
    const monthLabel = filters.month ? format(new Date(filters.month + '-01'), 'MMM-yyyy') : 'all';
    exportExpensesToCSV(expenses, `expenses-${monthLabel}.csv`);
    toast.success('Expenses exported successfully');
  };

  const handleExportSummary = () => {
    if (expenses.length === 0) {
      toast.error('No expenses to export');
      return;
    }
    exportExpensesSummaryToCSV(expenses, categories);
    toast.success('Summary exported successfully');
  };

  const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Expenses</h1>
            <p className="text-sm text-muted-foreground">
              Manage and track your expenses
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdvanced && (
              <Button 
                variant="outline" 
                size={isMobile ? "sm" : "default"}
                className="gap-2"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import Statement</span>
                <span className="sm:hidden">Import</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size={isMobile ? "sm" : "default"}
                  className="gap-2" 
                  disabled={expenses.length === 0}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  Export Expenses (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSummary}>
                  Export Summary (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Desktop add button */}
            {!isMobile && (
              <Button onClick={() => setExpenseDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <ExpenseFiltersBar 
          filters={filters} 
          onFiltersChange={setFilters} 
        />

        {/* Summary */}
        <div className="flex items-center justify-between p-3 md:p-4 bg-card rounded-lg border border-border/50">
          <div>
            <p className="text-xs md:text-sm text-muted-foreground">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs md:text-sm text-muted-foreground">Total</p>
            <p className="text-lg md:text-xl font-bold tabular-nums text-destructive">
              -{formatCurrency(totalAmount)}
            </p>
          </div>
        </div>

        {/* Expense List */}
        <Card className="border-border/50">
          <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ExpenseList 
                expenses={expenses} 
                onEdit={handleEditExpense}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Add Button (mobile only) */}
      {isMobile && (
        <FloatingAddButton onClick={() => setExpenseDialogOpen(true)} />
      )}

      {/* Expense Form Dialog */}
      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={(open) => {
          setExpenseDialogOpen(open);
          if (!open) setEditingExpense(null);
        }}
        expense={editingExpense}
      />

      {/* Import Wizard Dialog */}
      <ImportWizardDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </AppLayout>
  );
}
