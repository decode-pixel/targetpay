import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Category, CATEGORY_COLORS, CATEGORY_ICONS, CategoryType } from '@/types/expense';
import { inferCategoryType } from '@/types/budget';
import { useCreateCategory, useUpdateCategory, useCategories } from '@/hooks/useCategories';
import DynamicIcon from '@/components/ui/DynamicIcon';
import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
}

export default function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const isMobile = useIsMobile();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const { data: existingCategories = [] } = useCategories();

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(80);

  const isEditing = !!category;

  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setColor(category.color);
        setIcon(category.icon);
        setMonthlyBudget(category.monthly_budget?.toString() || '');
        setAlertThreshold(category.budget_alert_threshold ?? 80);
      } else {
        resetForm();
      }
    }
  }, [category, open]);

  const resetForm = () => {
    setName('');
    setColor(CATEGORY_COLORS[0]);
    setIcon(CATEGORY_ICONS[0]);
    setMonthlyBudget('');
    setAlertThreshold(80);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Please enter a category name');
      return;
    }

    // Check for duplicate names
    const isDuplicate = existingCategories.some(
      (cat) => cat.name.toLowerCase() === trimmedName.toLowerCase() && cat.id !== category?.id
    );

    if (isDuplicate) {
      toast.error('A category with this name already exists');
      return;
    }

    const categoryData = {
      name: trimmedName,
      color,
      icon,
      monthly_budget: monthlyBudget ? parseFloat(monthlyBudget) : null,
      budget_alert_threshold: alertThreshold,
      category_type: inferCategoryType(trimmedName) as CategoryType,
    };

    try {
      if (isEditing && category) {
        await updateCategory.mutateAsync({ id: category.id, ...categoryData });
      } else {
        await createCategory.mutateAsync(categoryData);
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const isSubmitting = createCategory.isPending || updateCategory.isPending;

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5 px-1">
      {/* Preview */}
      <div className="flex items-center justify-center py-4 bg-muted rounded-xl">
        <div
          className="h-16 w-16 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{ backgroundColor: color + '30' }}
        >
          <DynamicIcon name={icon} className="h-8 w-8" style={{ color }} />
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Food & Dining"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 text-base"
          autoComplete="off"
          required
        />
      </div>

      {/* Icon */}
      <div className="space-y-2">
        <Label>Icon</Label>
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </div>

      {/* Color */}
      <div className="space-y-2">
        <Label>Color</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      {/* Monthly Budget */}
      <div className="space-y-2">
        <Label htmlFor="budget">Monthly Budget (optional)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
          <Input
            id="budget"
            type="number"
            step="1"
            min="0"
            placeholder="0"
            className="pl-7 h-12 text-base"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
          />
        </div>
      </div>

      {/* Budget Alert Threshold */}
      {monthlyBudget && parseFloat(monthlyBudget) > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="threshold">Alert Threshold</Label>
            <span className="text-sm font-medium text-primary tabular-nums">{alertThreshold}%</span>
          </div>
          <Input
            id="threshold"
            type="range"
            min="50"
            max="100"
            step="5"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
            className="h-2 cursor-pointer accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            You'll be alerted when spending reaches {alertThreshold}% of your budget
          </p>
        </div>
      )}

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
          disabled={isSubmitting || !name.trim()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isEditing ? 'Update' : 'Add Category'}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DrawerTitle>
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
          <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
