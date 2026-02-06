import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Pencil, 
  Trash2, 
  MoreHorizontal,
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  Wallet,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Expense, PaymentMethod } from '@/types/expense';
import { useDeleteExpense } from '@/hooks/useExpenses';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ExpenseListProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
}

const paymentIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="h-3.5 w-3.5" />,
  upi: <Smartphone className="h-3.5 w-3.5" />,
  card: <CreditCard className="h-3.5 w-3.5" />,
  bank: <Building2 className="h-3.5 w-3.5" />,
  wallet: <Wallet className="h-3.5 w-3.5" />,
};

export default function ExpenseList({ expenses, onEdit }: ExpenseListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const deleteExpense = useDeleteExpense();
  const isMobile = useIsMobile();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteExpense.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Wallet className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base md:text-lg font-medium mb-1">No expenses found</h3>
        <p className="text-muted-foreground text-sm">
          Add your first expense to start tracking
        </p>
      </div>
    );
  }

  // Group expenses by date
  const groupedExpenses = expenses.reduce((groups, expense) => {
    const date = expense.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(expense);
    return groups;
  }, {} as Record<string, Expense[]>);

  const dates = Object.keys(groupedExpenses);

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {dates.map((date, dateIndex) => {
          const dayExpenses = groupedExpenses[date];
          const dayTotal = dayExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
          const isExpanded = expandedDate === date || !isMobile || dateIndex === 0;

          if (isMobile) {
            return (
              <Collapsible
                key={date}
                open={isExpanded}
                onOpenChange={(open) => setExpandedDate(open ? date : null)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between py-2 px-1">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {format(new Date(date), 'EEE, MMM d')}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-destructive tabular-nums">
                        -{formatCurrency(dayTotal)}
                      </span>
                      {dateIndex !== 0 && (
                        isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2">
                    {dayExpenses.map((expense) => (
                      <MobileExpenseCard
                        key={expense.id}
                        expense={expense}
                        onEdit={onEdit}
                        onDelete={setDeleteId}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="space-y-2">
                {dayExpenses.map((expense) => (
                  <DesktopExpenseRow
                    key={expense.id}
                    expense={expense}
                    onEdit={onEdit}
                    onDelete={setDeleteId}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This expense will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Mobile card component
function MobileExpenseCard({ 
  expense, 
  onEdit, 
  onDelete,
  formatCurrency 
}: { 
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/30 animate-fade-in">
      {/* Category Icon */}
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: expense.category?.color + '20' }}
      >
        <DynamicIcon
          name={expense.category?.icon || 'tag'}
          className="h-5 w-5"
          style={{ color: expense.category?.color }}
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {expense.category?.name || 'Uncategorized'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {paymentIcons[expense.payment_method]}
          </span>
          {expense.note && (
            <p className="text-xs text-muted-foreground truncate">
              {expense.note}
            </p>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="font-semibold text-sm tabular-nums text-destructive">
          -{formatCurrency(Number(expense.amount))}
        </p>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(expense)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(expense.id)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Desktop row component
function DesktopExpenseRow({ 
  expense, 
  onEdit, 
  onDelete,
  formatCurrency 
}: { 
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="expense-row group">
      {/* Category Icon */}
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: expense.category?.color + '20' }}
      >
        <DynamicIcon
          name={expense.category?.icon || 'tag'}
          className="h-5 w-5"
          style={{ color: expense.category?.color }}
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">
            {expense.category?.name || 'Uncategorized'}
          </p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {paymentIcons[expense.payment_method]}
            <span className="capitalize">{expense.payment_method}</span>
          </span>
        </div>
        {expense.note && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {expense.note}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="font-semibold tabular-nums text-destructive">
          -{formatCurrency(Number(expense.amount))}
        </p>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(expense)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(expense.id)}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
