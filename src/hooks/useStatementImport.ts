import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { StatementImport, ExtractedTransaction } from '@/types/import';

export function useStatementImports() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['statement-imports'],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('statement_imports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as StatementImport[];
    },
    enabled: !!user,
  });
}

export function useStatementImport(importId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['statement-import', importId],
    queryFn: async () => {
      if (!user || !importId) return null;
      
      const { data, error } = await supabase
        .from('statement_imports')
        .select('*')
        .eq('id', importId)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as StatementImport;
    },
    enabled: !!user && !!importId,
    refetchInterval: (query) => {
      const data = query.state.data as StatementImport | null;
      // Poll while processing
      if (data && ['pending', 'processing', 'categorizing'].includes(data.status)) {
        return 2000;
      }
      return false;
    },
  });
}

export function useExtractedTransactions(importId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['extracted-transactions', importId],
    queryFn: async () => {
      if (!user || !importId) return [];
      
      const { data, error } = await supabase
        .from('extracted_transactions')
        .select(`
          *,
          suggested_category:categories(id, name, color, icon)
        `)
        .eq('import_id', importId)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as ExtractedTransaction[];
    },
    enabled: !!user && !!importId,
  });
}

export function useUploadStatement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated');

      // Validate file
      if (file.type !== 'application/pdf') {
        throw new Error('Only PDF files are supported');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Upload to storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('bank-statements')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('statement_imports')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_hash: '', // Will be computed by edge function
          status: 'pending',
        })
        .select()
        .single();

      if (importError) throw importError;

      return importRecord as StatementImport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statement-imports'] });
    },
    onError: (error) => {
      toast.error('Upload failed: ' + error.message);
    },
  });
}

export function useParseStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ importId, password }: { importId: string; password?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-bank-statement`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ importId, ...(password && { password }) }),
        }
      );

      const result = await response.json();
      
      // Handle password required response (not an error, just needs password)
      if (result.passwordRequired) {
        return {
          ...result,
          success: false,
          passwordRequired: true,
        };
      }
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse statement');
      }

      return result;
    },
    onSuccess: (result, variables) => {
      // Don't invalidate if password is required - we're waiting for user input
      if (!result.passwordRequired) {
        queryClient.invalidateQueries({ queryKey: ['statement-import', variables.importId] });
        queryClient.invalidateQueries({ queryKey: ['extracted-transactions', variables.importId] });
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useCategorizeTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/categorize-transactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ importId }),
        }
      );

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to categorize transactions');
      }

      return result as {
        success: boolean;
        totalTransactions: number;
        categorizedCount: number;
        avgConfidence: number;
        suggestedCategories?: { name: string; icon: string; color: string }[];
      };
    },
    onSuccess: (_, importId) => {
      queryClient.invalidateQueries({ queryKey: ['statement-import', importId] });
      queryClient.invalidateQueries({ queryKey: ['extracted-transactions', importId] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useImportTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      importId, 
      transactions 
    }: { 
      importId: string; 
      transactions?: { id: string; category_id?: string }[] 
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-transactions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ importId, transactions }),
        }
      );

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to import transactions');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statement-imports'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Transactions imported successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateExtractedTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: Partial<ExtractedTransaction> & { id: string }) => {
      const { error } = await supabase
        .from('extracted_transactions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // We don't invalidate here to avoid refetching - let the UI update optimistically
    },
  });
}

export function useDeleteImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importId: string) => {
      // Get file path first
      const { data: importRecord } = await supabase
        .from('statement_imports')
        .select('file_path')
        .eq('id', importId)
        .single();

      // Delete the file from storage
      if (importRecord?.file_path) {
        await supabase.storage
          .from('bank-statements')
          .remove([importRecord.file_path]);
      }

      // Delete the import record (cascades to extracted_transactions)
      const { error } = await supabase
        .from('statement_imports')
        .delete()
        .eq('id', importId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statement-imports'] });
      toast.success('Import cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel import: ' + error.message);
    },
  });
}
