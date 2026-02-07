import { useState } from 'react';
import { Home, ShoppingBag, PiggyBank, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Category } from '@/types/expense';
import { CategoryType, inferCategoryType } from '@/types/budget';
import { useUpdateCategoryType } from '@/hooks/useFinancialSettings';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { cn } from '@/lib/utils';

interface CategoryTypeEditorProps {
  categories: Category[];
  className?: string;
}

const TYPE_CONFIG: Record<CategoryType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  needs: {
    label: 'Needs',
    icon: <Home className="h-4 w-4" />,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    description: 'Essential expenses',
  },
  wants: {
    label: 'Wants',
    icon: <ShoppingBag className="h-4 w-4" />,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    description: 'Discretionary spending',
  },
  savings: {
    label: 'Savings',
    icon: <PiggyBank className="h-4 w-4" />,
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
    description: 'Investments & savings',
  },
};

export default function CategoryTypeEditor({ categories, className }: CategoryTypeEditorProps) {
  const updateType = useUpdateCategoryType();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleTypeChange = async (categoryId: string, newType: CategoryType) => {
    await updateType.mutateAsync({ categoryId, categoryType: newType });
    setEditingId(null);
  };

  return (
    <Card className={cn('border-border/50', className)}>
      <CardHeader>
        <CardTitle className="text-base">Category Classification</CardTitle>
        <CardDescription>
          Assign each category to Needs, Wants, or Savings for smart budget rules
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {categories.map((category) => {
            const currentType = ((category as any).category_type as CategoryType) || inferCategoryType(category.name);
            const config = TYPE_CONFIG[currentType];
            const isEditing = editingId === category.id;

            return (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    <DynamicIcon
                      name={category.icon}
                      className="h-4 w-4"
                      style={{ color: category.color }}
                    />
                  </div>
                  <span className="font-medium text-sm">{category.name}</span>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1">
                    {(Object.keys(TYPE_CONFIG) as CategoryType[]).map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-8 gap-1',
                          type === currentType && TYPE_CONFIG[type].color
                        )}
                        onClick={() => handleTypeChange(category.id, type)}
                        disabled={updateType.isPending}
                      >
                        {TYPE_CONFIG[type].icon}
                        <span className="text-xs">{TYPE_CONFIG[type].label}</span>
                        {type === currentType && <Check className="h-3 w-3" />}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn('cursor-pointer gap-1.5', config.color)}
                    onClick={() => setEditingId(category.id)}
                  >
                    {config.icon}
                    {config.label}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
