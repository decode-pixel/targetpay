-- Fix: Add 'password_required' to allowed status values
ALTER TABLE public.statement_imports DROP CONSTRAINT statement_imports_status_check;

ALTER TABLE public.statement_imports ADD CONSTRAINT statement_imports_status_check 
  CHECK (status = ANY (ARRAY['pending', 'processing', 'extracted', 'categorizing', 'ready', 'completed', 'failed', 'password_required']));
