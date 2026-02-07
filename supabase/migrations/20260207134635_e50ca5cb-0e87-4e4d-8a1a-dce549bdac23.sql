-- Create category_budgets table for per-month, per-category budget control
CREATE TABLE public.category_budgets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    budget_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT category_budgets_month_format CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT category_budgets_unique_month UNIQUE (user_id, category_id, month)
);

-- Enable Row Level Security
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own category budgets"
ON public.category_budgets
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own category budgets"
ON public.category_budgets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category budgets"
ON public.category_budgets
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category budgets"
ON public.category_budgets
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for efficient lookups
CREATE INDEX idx_category_budgets_user_month ON public.category_budgets(user_id, month);
CREATE INDEX idx_category_budgets_category ON public.category_budgets(category_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_category_budgets_updated_at
BEFORE UPDATE ON public.category_budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to get effective budget for a category/month
-- Falls back to category.monthly_budget if no specific month budget exists
CREATE OR REPLACE FUNCTION public.get_effective_budget(
    p_user_id UUID,
    p_category_id UUID,
    p_month TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_budget NUMERIC;
BEGIN
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