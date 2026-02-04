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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Category, CATEGORY_ICONS, CATEGORY_COLORS } from '@/types/expense';
import { useCreateCategory, useUpdateCategory } from '@/hooks/useCategories';
import DynamicIcon from '@/components/ui/DynamicIcon';

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
}

export default function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(CATEGORY_ICONS[0]);
  const [monthlyBudget, setMonthlyBudget] = useState('');

  const isEditing = !!category;

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color);
      setIcon(category.icon);
      setMonthlyBudget(category.monthly_budget?.toString() || '');
    } else {
      resetForm();
    }
  }, [category, open]);

  const resetForm = () => {
    setName('');
    setColor(CATEGORY_COLORS[0]);
    setIcon(CATEGORY_ICONS[0]);
    setMonthlyBudget('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const categoryData = {
      name,
      color,
      icon,
      monthly_budget: monthlyBudget ? parseFloat(monthlyBudget) : null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preview */}
          <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
            <div
              className="h-16 w-16 rounded-xl flex items-center justify-center"
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
              required
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <DynamicIcon name={icon} className="h-4 w-4" />
                    <span className="capitalize">{icon.replace(/-/g, ' ')}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <div className="grid grid-cols-4 gap-1 p-2">
                  {CATEGORY_ICONS.map((iconName) => (
                    <Button
                      key={iconName}
                      type="button"
                      variant={icon === iconName ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setIcon(iconName)}
                    >
                      <DynamicIcon name={iconName} className="h-5 w-5" />
                    </Button>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-10 w-full rounded-lg border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
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
                className="pl-7"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !name}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Add Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
