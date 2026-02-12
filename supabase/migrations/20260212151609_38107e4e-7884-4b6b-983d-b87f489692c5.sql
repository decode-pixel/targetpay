
-- Fix 1: Add auth check to get_effective_budget function
CREATE OR REPLACE FUNCTION public.get_effective_budget(p_user_id uuid, p_category_id uuid, p_month text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_budget NUMERIC;
BEGIN
    -- Verify caller owns this data
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: cannot access other users budget data';
    END IF;

    -- First try to find a month-specific budget
    SELECT budget_amount INTO v_budget
    FROM public.category_budgets
    WHERE user_id = p_user_id 
      AND category_id = p_category_id 
      AND month = p_month;
    
    -- If found, return it
    IF v_budget IS NOT NULL THEN
        RETURN v_budget;
    END IF;
    
    -- Otherwise, fall back to the category's default monthly budget
    SELECT monthly_budget INTO v_budget
    FROM public.categories
    WHERE id = p_category_id AND user_id = p_user_id;
    
    RETURN COALESCE(v_budget, 0);
END;
$$;

-- Fix 2: Make avatars bucket private and restrict to authenticated users
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Fix 3: Add DELETE policy for profiles table
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);
