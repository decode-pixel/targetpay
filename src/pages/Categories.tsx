import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/layout/AppLayout';
import FloatingAddButton from '@/components/layout/FloatingAddButton';
import CategoryList from '@/components/categories/CategoryList';
import CategoryFormDialog from '@/components/categories/CategoryFormDialog';
import { useCategories } from '@/hooks/useCategories';
import { Category } from '@/types/expense';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Categories() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useCategories();

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Categories</h1>
            <p className="text-sm text-muted-foreground">
              Manage your expense categories and budgets
            </p>
          </div>
          {!isMobile && (
            <Button onClick={() => setCategoryDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          )}
        </div>

        {/* Category List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CategoryList 
            categories={categories} 
            onEdit={handleEditCategory}
          />
        )}
      </div>

      {/* Floating Add Button (mobile only) */}
      {isMobile && (
        <FloatingAddButton onClick={() => setCategoryDialogOpen(true)} />
      )}

      {/* Category Form Dialog */}
      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
      />
    </AppLayout>
  );
}
