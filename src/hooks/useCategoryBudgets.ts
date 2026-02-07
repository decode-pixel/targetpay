import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CategoryBudget {
  id: string;
  user_id: string;
  category_id: string;
  month: string; // YYYY-MM format
  budget_amount: number;
  created_at: string;
  updated_at: string;
}

export function useCategoryBudgets(month: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['category-budgets', month],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month);
      
      if (error) throw error;
      return data as CategoryBudget[];
    },
    enabled: !!user && !!month,
  });
}

export function useSetCategoryBudget() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      categoryId, 
      month, 
      budgetAmount 
    }: { 
      categoryId: string; 
      month: string; 
      budgetAmount: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Upsert - create or update the budget for this category/month
      const { data, error } = await supabase
        .from('category_budgets')
        .upsert({
          user_id: user.id,
          category_id: categoryId,
          month: month,
          budget_amount: budgetAmount,
        }, {
          onConflict: 'user_id,category_id,month',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['category-budgets', variables.month] });
      queryClient.invalidateQueries({ queryKey: ['category-budgets'] });
      toast.success('Budget updated');
    },
    onError: (error) => {
      toast.error('Failed to update budget: ' + error.message);
    },
  });
}

export function useDeleteCategoryBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, month }: { categoryId: string; month: string }) => {
      const { error } = await supabase
        .from('category_budgets')
        .delete()
        .eq('category_id', categoryId)
        .eq('month', month);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['category-budgets', variables.month] });
      queryClient.invalidateQueries({ queryKey: ['category-budgets'] });
      toast.success('Budget reset to default');
    },
    onError: (error) => {
      toast.error('Failed to reset budget: ' + error.message);
    },
  });
}

// Helper hook to get the effective budget for a category in a specific month
export function useEffectiveBudget(categoryId: string | undefined, month: string, defaultBudget: number | null) {
  const { data: monthBudgets = [] } = useCategoryBudgets(month);
  
  if (!categoryId) return defaultBudget || 0;
  
  const monthSpecificBudget = monthBudgets.find(b => b.category_id === categoryId);
  
  // Return month-specific budget if it exists, otherwise fall back to default
  return monthSpecificBudget?.budget_amount ?? defaultBudget ?? 0;
}

// Helper to get all effective budgets for a month (combining month-specific and defaults)
export function useAllEffectiveBudgets(month: string, categories: { id: string; monthly_budget: number | null }[]) {
  const { data: monthBudgets = [], isLoading } = useCategoryBudgets(month);
  
  const budgetMap = new Map<string, number>();
  
  // Start with default budgets from categories
  categories.forEach(cat => {
    budgetMap.set(cat.id, cat.monthly_budget ?? 0);
  });
  
  // Override with month-specific budgets
  monthBudgets.forEach(mb => {
    budgetMap.set(mb.category_id, mb.budget_amount);
  });
  
  return {
    budgets: budgetMap,
    isLoading,
    hasMonthSpecificBudget: (categoryId: string) => 
      monthBudgets.some(mb => mb.category_id === categoryId),
  };
}
