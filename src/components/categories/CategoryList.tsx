import { useState } from 'react';
import { Pencil, Trash2, MoreHorizontal, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { Category } from '@/types/expense';
import { useDeleteCategory } from '@/hooks/useCategories';
import { useExpenses } from '@/hooks/useExpenses';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface CategoryListProps {
  categories: Category[];
  onEdit: (category: Category) => void;
}

export default function CategoryList({ categories, onEdit }: CategoryListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteCategory = useDeleteCategory();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const currentMonth = format(new Date(), 'yyyy-MM');
  const { data: expenses = [] } = useExpenses({ month: currentMonth });

  const categorySpending = expenses.reduce((acc, exp) => {
    if (exp.category_id) {
      acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteCategory.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleViewExpenses = (categoryId: string) => {
    navigate(`/expenses?category=${categoryId}`);
  };

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-base md:text-lg font-medium mb-1">No categories yet</h3>
        <p className="text-muted-foreground text-sm">
          Create categories to organize your expenses
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {categories.map((category) => {
          const spent = categorySpending[category.id] || 0;
          const budget = Number(category.monthly_budget) || 0;
          const percentage = budget > 0 ? (spent / budget) * 100 : 0;
          const isOverBudget = percentage > 100;

          return (
            <div
              key={category.id}
              className={cn(
                "bg-card rounded-xl p-4 border border-border/50 transition-all duration-200",
                "hover:shadow-md",
                isMobile && "active:scale-[0.98]"
              )}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div 
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleViewExpenses(category.id)}
                >
                  <div
                    className="h-11 w-11 md:h-12 md:w-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    <DynamicIcon
                      name={category.icon}
                      className="h-5 w-5 md:h-6 md:w-6"
                      style={{ color: category.color }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm md:text-base truncate">{category.name}</h3>
                    {budget > 0 && (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Budget: {formatCurrency(budget)}
                      </p>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 shrink-0",
                        !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewExpenses(category.id)}>
                      <ChevronRight className="mr-2 h-4 w-4" />
                      View Expenses
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(category)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteId(category.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Spending Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Spent this month</span>
                  <span className={cn(
                    "font-semibold tabular-nums",
                    isOverBudget && "text-destructive"
                  )}>
                    {formatCurrency(spent)}
                  </span>
                </div>

                {budget > 0 && (
                  <>
                    <Progress
                      value={Math.min(percentage, 100)}
                      className={cn(
                        "h-2",
                        isOverBudget && "[&>div]:bg-destructive"
                      )}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{percentage.toFixed(0)}% used</span>
                      <span>
                        {isOverBudget 
                          ? `${formatCurrency(spent - budget)} over`
                          : `${formatCurrency(budget - spent)} left`
                        }
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the category. Expenses in this category will become uncategorized.
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
