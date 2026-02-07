import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Category } from '@/types/expense';
import { useUpdateCategory } from '@/hooks/useCategories';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';

interface BudgetEditCardProps {
  category: Category;
  spent: number;
}

export default function BudgetEditCard({ category, spent }: BudgetEditCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [budgetValue, setBudgetValue] = useState(category.monthly_budget?.toString() || '');
  const updateCategory = useUpdateCategory();

  const budget = Number(category.monthly_budget) || 0;
  const remaining = budget - spent;
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverBudget = percentage > 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const handleSave = async () => {
    const newBudget = budgetValue ? parseFloat(budgetValue) : null;
    await updateCategory.mutateAsync({
      id: category.id,
      monthly_budget: newBudget,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setBudgetValue(category.monthly_budget?.toString() || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-card rounded-xl p-4 border border-border/50 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: category.color + '20' }}
          >
            <DynamicIcon
              name={category.icon}
              className="h-5 w-5"
              style={{ color: category.color }}
            />
          </div>
          <div>
            <h3 className="font-medium text-sm">{category.name}</h3>
            <p className="text-xs text-muted-foreground">
              Spent: {formatCurrency(spent)}
            </p>
          </div>
        </div>

        {!isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Budget edit mode */}
      {isEditing ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <Input
              type="number"
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
              placeholder="0"
              className="pl-7 h-10"
              autoFocus
            />
          </div>
          <Button
            size="icon"
            className="h-10 w-10"
            onClick={handleSave}
            disabled={updateCategory.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          {/* Budget display */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Budget</span>
            <span className="font-semibold tabular-nums">
              {budget > 0 ? formatCurrency(budget) : 'Not set'}
            </span>
          </div>

          {/* Progress bar */}
          {budget > 0 && (
            <div className="space-y-1.5">
              <Progress
                value={Math.min(percentage, 100)}
                className={cn(
                  "h-2",
                  isOverBudget && "[&>div]:bg-destructive"
                )}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{percentage.toFixed(0)}% used</span>
                <span className={cn(isOverBudget && "text-destructive font-medium")}>
                  {isOverBudget 
                    ? `${formatCurrency(Math.abs(remaining))} over`
                    : `${formatCurrency(remaining)} left`
                  }
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
