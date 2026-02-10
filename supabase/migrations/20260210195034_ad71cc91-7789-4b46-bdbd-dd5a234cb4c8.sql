
CREATE OR REPLACE FUNCTION public.cleanup_expired_imports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Delete expired imports (cascades to extracted_transactions)
  DELETE FROM public.statement_imports
  WHERE expires_at < now() AND status != 'completed';
END;
$$;
