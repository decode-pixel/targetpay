-- Fix increment_mapping_count to validate the caller owns the mapping
-- This prevents users from manipulating other users' mapping counts

CREATE OR REPLACE FUNCTION public.increment_mapping_count(p_user_id uuid, p_keyword text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller owns this mapping - prevents privilege escalation
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot modify other users mappings';
  END IF;
  
  UPDATE public.category_mappings
  SET usage_count = usage_count + 1
  WHERE user_id = p_user_id AND keyword = p_keyword;
END;
$$;