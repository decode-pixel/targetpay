import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Expense, ExpenseFilters, PaymentMethod } from '@/types/expense';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';

// Validation schema for search input - prevents query abuse and performance issues
const searchSchema = z.string().max(100).regex(/^[a-zA-Z0-9\s\-_.,!?₹$€£¥@#%&*()]*$/).optional();

// Sanitize search input by removing potentially problematic patterns
function sanitizeSearchInput(input: string | undefined): string | null {
  if (!input) return null;
  
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  try {
    const validated = searchSchema.parse(trimmed);
    return validated || null;
  } catch {
    // If validation fails, return null to skip the search filter
    return null;
  }
}

export function useExpenses(filters?: ExpenseFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('user_id', user.id)
        .eq('is_draft', false)
        .order('date', { ascending: false });

      if (filters?.month) {
        const [year, month] = filters.month.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        query = query.gte('date', startDate).lte('date', endDate);
      }

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters?.paymentMethod) {
        query = query.eq('payment_method', filters.paymentMethod);
      }

      if (filters?.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      // Validate and sanitize search input before querying
      const sanitizedSearch = sanitizeSearchInput(filters?.search);
      if (sanitizedSearch) {
        query = query.ilike('note', `%${sanitizedSearch}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!user,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          ...expense,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add expense: ' + error.message);
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...expense }: Partial<Expense> & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(expense)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update expense: ' + error.message);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete expense: ' + error.message);
    },
  });
}
