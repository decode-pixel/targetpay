-- Create function to increment category mapping usage count
CREATE OR REPLACE FUNCTION public.increment_mapping_count(p_user_id uuid, p_keyword text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.category_mappings
  SET usage_count = usage_count + 1
  WHERE user_id = p_user_id AND keyword = p_keyword;
END;
$$;