import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Expense, PaymentMethod, PAYMENT_METHODS } from '@/types/expense';
import { useCategories } from '@/hooks/useCategories';
import { useCreateExpense, useUpdateExpense, useExpenses } from '@/hooks/useExpenses';
import { useFinancialSettings } from '@/hooks/useFinancialSettings';
import { useAllEffectiveBudgets } from '@/hooks/useCategoryBudgets';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
}

export default function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const { data: categories = [] } = useCategories();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const isMobile = useIsMobile();
  const { data: financialSettings } = useFinancialSettings();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState('');
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [pendingExpenseData, setPendingExpenseData] = useState<any>(null);

  const month = format(date, 'yyyy-MM');
  const { data: monthExpenses = [] } = useExpenses({ month });
  const { budgets: effectiveBudgets } = useAllEffectiveBudgets(month, categories);

  const budgetMode = financialSettings?.budget_mode || 'flexible';
  const isEditing = !!expense;

  useEffect(() => {
    if (open) {
      if (expense) {
        setAmount(expense.amount.toString());
        setCategoryId(expense.category_id || '');
        setDate(new Date(expense.date));
        setPaymentMethod(expense.payment_method);
        setNote(expense.note || '');
      } else {
        resetForm();
      }
    }
  }, [expense, open]);

  const resetForm = () => {
    setAmount('');
    setCategoryId('');
    setDate(new Date());
    setPaymentMethod('cash');
    setNote('');
  };

  const checkBudgetOverage = () => {
    if (!categoryId || budgetMode === 'flexible') return null;
    
    const budget = effectiveBudgets.get(categoryId) || 0;
    if (budget <= 0) return null;
    
    const currentSpent = monthExpenses
      .filter(e => e.category_id === categoryId && (!isEditing || e.id !== expense?.id))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const newTotal = currentSpent + (parseFloat(amount) || 0);
    const overage = newTotal - budget;
    
    if (overage > 0) {
      const cat = categories.find(c => c.id === categoryId);
      return {
        categoryName: cat?.name || 'this category',
        overage,
        budget,
        newTotal,
      };
    }
    return null;
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(val);

  const doSubmit = async (data: any) => {
    try {
      if (isEditing && expense) {
        await updateExpense.mutateAsync({ id: expense.id, ...data });
      } else {
        await createExpense.mutateAsync(data);
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Amount must be greater than zero');
      return;
    }
    setAmountError('');

    const expenseData = {
      amount: parseFloat(amount),
      category_id: categoryId || null,
      date: format(date, 'yyyy-MM-dd'),
      payment_method: paymentMethod,
      note: note || null,
      is_draft: false,
    };

    // Check budget overage based on mode
    const overage = checkBudgetOverage();
    
    if (overage) {
      if (budgetMode === 'guided') {
        // Show warning toast but allow
        toast.warning(`This will exceed your ${overage.categoryName} budget by ${formatCurrency(overage.overage)}`, {
          description: `Budget: ${formatCurrency(overage.budget)} → New total: ${formatCurrency(overage.newTotal)}`,
        });
        await doSubmit(expenseData);
      } else if (budgetMode === 'strict') {
        // Show confirmation dialog
        setPendingExpenseData(expenseData);
        setShowOverrideDialog(true);
        return;
      }
    } else {
      await doSubmit(expenseData);
    }
  };

  const handleOverrideConfirm = async () => {
    if (pendingExpenseData) {
      await doSubmit(pendingExpenseData);
      setPendingExpenseData(null);
      setShowOverrideDialog(false);
    }
  };

  const isSubmitting = createExpense.isPending || updateExpense.isPending;
  const overageInfo = checkBudgetOverage();

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 px-1">
      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">₹</span>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-8 h-12 text-xl font-semibold"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
            autoFocus={!isMobile}
            required
          />
        </div>
        {amountError && <p className="text-xs text-destructive">{amountError}</p>}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-5 w-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: cat.color + '30' }}
                  >
                    <DynamicIcon name={cat.icon} className="h-3 w-3" style={{ color: cat.color }} />
                  </div>
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Budget overage warning preview (Guided/Strict) */}
      {overageInfo && budgetMode !== 'flexible' && (
        <div className={cn(
          'flex items-start gap-2 p-3 rounded-lg text-xs',
          budgetMode === 'strict' 
            ? 'bg-destructive/10 border border-destructive/30 text-destructive' 
            : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
        )}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {budgetMode === 'strict' ? 'Budget Violation' : 'Over Budget Warning'}
            </p>
            <p>
              This will exceed {overageInfo.categoryName} budget by {formatCurrency(overageInfo.overage)}
              {budgetMode === 'strict' && ' — override confirmation will be required'}
            </p>
          </div>
        </div>
      )}

      {/* Date */}
      <div className="space-y-2">
        <Label>Date *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal h-11',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Payment Method */}
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <div className="grid grid-cols-5 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => setPaymentMethod(method.value)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all duration-150',
                'border-2 touch-manipulation',
                paymentMethod === method.value
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent bg-muted hover:bg-muted/80'
              )}
            >
              <DynamicIcon name={method.icon} className="h-5 w-5" />
              <span className="text-xs">{method.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Textarea
          id="note"
          placeholder="Add a note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2 pb-safe">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-12 text-base"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 h-12 text-base"
          disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isEditing ? 'Update' : 'Add Expense'}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 overflow-y-auto">
              {formContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      )}

      {/* Strict Mode Override Dialog */}
      <AlertDialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Budget Violation
            </AlertDialogTitle>
            <AlertDialogDescription>
              {overageInfo && (
                <>
                  This expense exceeds your <strong>{overageInfo.categoryName}</strong> budget 
                  by <strong>{formatCurrency(overageInfo.overage)}</strong>.
                  <br /><br />
                  Budget: {formatCurrency(overageInfo.budget)} → New total: {formatCurrency(overageInfo.newTotal)}
                  <br /><br />
                  Are you sure you want to override strict mode and save this expense?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingExpenseData(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOverrideConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Override & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
