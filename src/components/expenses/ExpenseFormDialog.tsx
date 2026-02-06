import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
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
import { Expense, PaymentMethod, PAYMENT_METHODS } from '@/types/expense';
import { useCategories } from '@/hooks/useCategories';
import { useCreateExpense, useUpdateExpense } from '@/hooks/useExpenses';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const expenseData = {
      amount: parseFloat(amount),
      category_id: categoryId || null,
      date: format(date, 'yyyy-MM-dd'),
      payment_method: paymentMethod,
      note: note || null,
      is_draft: false,
    };

    try {
      if (isEditing && expense) {
        await updateExpense.mutateAsync({ id: expense.id, ...expenseData });
      } else {
        await createExpense.mutateAsync(expenseData);
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const isSubmitting = createExpense.isPending || updateExpense.isPending;

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
            onChange={(e) => setAmount(e.target.value)}
            autoFocus={!isMobile}
            required
          />
        </div>
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

      {/* Payment Method - Grid for touch-friendly selection */}
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
          disabled={isSubmitting || !amount}
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

  if (isMobile) {
    return (
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
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
