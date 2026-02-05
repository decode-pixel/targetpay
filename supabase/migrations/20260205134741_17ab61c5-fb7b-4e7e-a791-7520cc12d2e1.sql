-- Create storage bucket for bank statements with 24-hour retention
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bank-statements', 'bank-statements', false, 10485760, ARRAY['application/pdf']);

-- RLS policies for bank statements bucket
CREATE POLICY "Users can upload their own bank statements"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own bank statements"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own bank statements"
ON storage.objects
FOR DELETE
USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create table for tracking statement imports
CREATE TABLE public.statement_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  bank_name TEXT,
  statement_period_start DATE,
  statement_period_end DATE,
  total_transactions INTEGER DEFAULT 0,
  imported_transactions INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'extracted', 'categorizing', 'ready', 'completed', 'failed')),
  error_message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for extracted transactions (temporary before import)
CREATE TABLE public.extracted_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id UUID NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  balance NUMERIC(12,2),
  raw_text TEXT,
  suggested_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ai_confidence NUMERIC(3,2),
  is_selected BOOLEAN DEFAULT true,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for category learning/mapping
CREATE TABLE public.category_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, keyword)
);

-- Enable RLS on all tables
ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for statement_imports
CREATE POLICY "Users can view their own imports"
ON public.statement_imports
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own imports"
ON public.statement_imports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imports"
ON public.statement_imports
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imports"
ON public.statement_imports
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for extracted_transactions
CREATE POLICY "Users can view their own extracted transactions"
ON public.extracted_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own extracted transactions"
ON public.extracted_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extracted transactions"
ON public.extracted_transactions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extracted transactions"
ON public.extracted_transactions
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for category_mappings
CREATE POLICY "Users can view their own category mappings"
ON public.category_mappings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own category mappings"
ON public.category_mappings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category mappings"
ON public.category_mappings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category mappings"
ON public.category_mappings
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_statement_imports_user_id ON public.statement_imports(user_id);
CREATE INDEX idx_statement_imports_file_hash ON public.statement_imports(file_hash);
CREATE INDEX idx_statement_imports_status ON public.statement_imports(status);
CREATE INDEX idx_extracted_transactions_import_id ON public.extracted_transactions(import_id);
CREATE INDEX idx_extracted_transactions_user_id ON public.extracted_transactions(user_id);
CREATE INDEX idx_category_mappings_user_id ON public.category_mappings(user_id);
CREATE INDEX idx_category_mappings_keyword ON public.category_mappings(keyword);

-- Trigger for updated_at
CREATE TRIGGER update_statement_imports_updated_at
BEFORE UPDATE ON public.statement_imports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_category_mappings_updated_at
BEFORE UPDATE ON public.category_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up expired imports
CREATE OR REPLACE FUNCTION public.cleanup_expired_imports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired imports (cascades to extracted_transactions)
  DELETE FROM public.statement_imports
  WHERE expires_at < now() AND status != 'completed';
END;
$$;