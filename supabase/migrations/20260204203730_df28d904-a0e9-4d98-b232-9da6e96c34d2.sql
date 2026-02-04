-- Update create_default_categories function to validate it's only called from trigger context
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure this function is only called from a trigger context
    IF TG_OP IS NULL THEN
        RAISE EXCEPTION 'This function must be called from a trigger';
    END IF;
    
    -- Validate that NEW.id exists (the user being created)
    IF NEW.id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    INSERT INTO public.categories (user_id, name, color, icon, monthly_budget) VALUES
        (NEW.id, 'Food & Dining', '#F97316', 'utensils', 5000),
        (NEW.id, 'Transportation', '#3B82F6', 'car', 3000),
        (NEW.id, 'Shopping', '#EC4899', 'shopping-bag', 4000),
        (NEW.id, 'Entertainment', '#8B5CF6', 'gamepad-2', 2000),
        (NEW.id, 'Bills & Utilities', '#EF4444', 'receipt', 5000),
        (NEW.id, 'Healthcare', '#10B981', 'heart-pulse', 2000),
        (NEW.id, 'Education', '#06B6D4', 'graduation-cap', 3000),
        (NEW.id, 'Other', '#6B7280', 'more-horizontal', NULL);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comment to document the security consideration
COMMENT ON FUNCTION public.create_default_categories() IS 'Creates default expense categories for new users. SECURITY DEFINER is required to bypass RLS during user creation. Must only be called from auth.users INSERT trigger.';