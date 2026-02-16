import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Check, X, RotateCcw, Calendar, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Category } from '@/types/expense';
import { 
  useSetCategoryBudget, 
  useDeleteCategoryBudget,
  useCategoryBudgets 
} from '@/hooks/useCategoryBudgets';
import { useFinancialSettings } from '@/hooks/useFinancialSettings';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';
import { BudgetMode } from '@/types/budget';

interface MonthlyBudgetEditorProps {
  category: Category;
  month: string;
  spent: number;
}

export default function MonthlyBudgetEditor({ 
  category, 
  month, 
  spent 
}: MonthlyBudgetEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [budgetValue, setBudgetValue] = useState('');
  
  const { data: monthBudgets = [] } = useCategoryBudgets(month);
  const { data: financialSettings } = useFinancialSettings();
  const setBudgetMutation = useSetCategoryBudget();
  const deleteBudgetMutation = useDeleteCategoryBudget();

  const budgetMode: BudgetMode = financialSettings?.budget_mode || 'flexible';
  const smartRulesEnabled = financialSettings?.smart_rules_enabled ?? true;

  const monthSpecificBudget = monthBudgets.find(b => b.category_id === category.id);
  const hasMonthSpecificBudget = !!monthSpecificBudget;
  
  const effectiveBudget = hasMonthSpecificBudget 
    ? monthSpecificBudget.budget_amount 
    : (category.monthly_budget ?? 0);

  const remaining = effectiveBudget - spent;
  const percentage = effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;
  const isOverBudget = percentage > 100;
  const isNearLimit = percentage > 80;

  const monthLabel = format(new Date(`${month}-01`), 'MMMM yyyy');

  // Mode-aware styling
  const showModeEffects = smartRulesEnabled && budgetMode !== 'flexible';
  const isGuidedWarning = showModeEffects && budgetMode === 'guided' && isNearLimit;
  const isStrictViolation = showModeEffects && budgetMode === 'strict' && isOverBudget;
  const isStrictWarning = showModeEffects && budgetMode === 'strict' && isNearLimit && !isOverBudget;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const handleStartEdit = () => {
    setBudgetValue(effectiveBudget.toString());
    setIsEditing(true);
  };

  const handleSave = async () => {
    const newBudget = parseFloat(budgetValue) || 0;
    await setBudgetMutation.mutateAsync({
      categoryId: category.id,
      month: month,
      budgetAmount: newBudget,
    });
    setIsEditing(false);
  };

  const handleResetToDefault = async () => {
    await deleteBudgetMutation.mutateAsync({
      categoryId: category.id,
      month: month,
    });
  };

  const handleCancel = () => {
    setBudgetValue('');
    setIsEditing(false);
  };

  return (
    <div className={cn(
      'bg-card rounded-xl p-4 border space-y-3 transition-all duration-300',
      isStrictViolation 
        ? 'border-destructive/60 bg-destructive/5 shadow-[0_0_0_1px_hsl(var(--destructive)/0.3)] animate-pulse' 
        : isGuidedWarning || isStrictWarning
          ? 'border-orange-500/50 bg-orange-500/5'
          : 'border-border/50'
    )}>
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
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{category.name}</h3>
              {hasMonthSpecificBudget && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-xs gap-1 px-1.5">
                        <Calendar className="h-3 w-3" />
                        Custom
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Custom budget for {monthLabel}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Mode badges */}
              {isStrictViolation && (
                <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 py-0">
                  <Lock className="h-2.5 w-2.5" />
                  VIOLATION
                </Badge>
              )}
              {(isGuidedWarning || isStrictWarning) && !isOverBudget && (
                <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0 border-orange-500/50 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Warning
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Spent: {formatCurrency(spent)}
            </p>
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-1">
            {hasMonthSpecificBudget && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleResetToDefault}
                      disabled={deleteBudgetMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset to default budget ({formatCurrency(category.monthly_budget ?? 0)})</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleStartEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Budget edit mode */}
      {isEditing ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Set budget for {monthLabel}
          </p>
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
              disabled={setBudgetMutation.isPending}
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
        </div>
      ) : (
        <>
          {/* Budget display */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {monthLabel} Budget
            </span>
            <span className="font-semibold tabular-nums">
              {effectiveBudget > 0 ? formatCurrency(effectiveBudget) : 'Not set'}
            </span>
          </div>

          {/* Progress bar */}
          {effectiveBudget > 0 && (
            <div className="space-y-1.5">
              <Progress
                value={Math.min(percentage, 100)}
                className={cn(
                  "h-2",
                  isOverBudget && "[&>div]:bg-destructive",
                  !isOverBudget && isNearLimit && showModeEffects && "[&>div]:bg-orange-500"
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
