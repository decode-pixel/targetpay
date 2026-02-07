import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { UserFinancialSettings, BudgetMode } from '@/types/budget';

export function useFinancialSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['financial-settings', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_financial_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Return default settings if none exist
      if (!data) {
        return {
          id: '',
          user_id: user.id,
          monthly_income: null,
          budget_mode: 'flexible' as BudgetMode,
          needs_percentage: 50,
          wants_percentage: 30,
          savings_percentage: 20,
          min_savings_target: 0,
          show_budget_suggestions: true,
          smart_rules_enabled: true, // Default to smart rules enabled
          created_at: '',
          updated_at: '',
        } as UserFinancialSettings;
      }

      // Ensure smart_rules_enabled has a default if not set
      return {
        ...data,
        smart_rules_enabled: data.smart_rules_enabled ?? true,
      } as UserFinancialSettings;
    },
    enabled: !!user,
  });
}

export function useUpdateFinancialSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserFinancialSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      if (!user) throw new Error('Not authenticated');

      // Upsert - create or update
      const { data, error } = await supabase
        .from('user_financial_settings')
        .upsert({
          user_id: user.id,
          ...updates,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data as UserFinancialSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-settings'] });
      toast.success('Settings saved');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + error.message);
    },
  });
}

export function useUpdateCategoryType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId, categoryType }: { categoryId: string; categoryType: string }) => {
      const { error } = await supabase
        .from('categories')
        .update({ category_type: categoryType })
        .eq('id', categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error) => {
      toast.error('Failed to update category type: ' + error.message);
    },
  });
}
