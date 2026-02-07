-- Add category_type to categories table for Needs/Wants/Savings classification
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'wants' CHECK (category_type IN ('needs', 'wants', 'savings'));

-- Create user_financial_settings table for income and budget preferences
CREATE TABLE IF NOT EXISTS public.user_financial_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  monthly_income NUMERIC DEFAULT NULL,
  budget_mode TEXT DEFAULT 'flexible' CHECK (budget_mode IN ('flexible', 'strict', 'guided')),
  needs_percentage NUMERIC DEFAULT 50 CHECK (needs_percentage >= 0 AND needs_percentage <= 100),
  wants_percentage NUMERIC DEFAULT 30 CHECK (wants_percentage >= 0 AND wants_percentage <= 100),
  savings_percentage NUMERIC DEFAULT 20 CHECK (savings_percentage >= 0 AND savings_percentage <= 100),
  min_savings_target NUMERIC DEFAULT 0,
  show_budget_suggestions BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_financial_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_financial_settings
CREATE POLICY "Users can view their own financial settings"
ON public.user_financial_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own financial settings"
ON public.user_financial_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own financial settings"
ON public.user_financial_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_financial_settings_updated_at
BEFORE UPDATE ON public.user_financial_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update default categories with appropriate category_type
-- This will only affect existing categories based on their names
UPDATE public.categories SET category_type = 'needs' 
WHERE name ILIKE ANY (ARRAY['%rent%', '%food%', '%bill%', '%utilities%', '%transport%', '%healthcare%', '%grocery%', '%medical%', '%insurance%', '%education%']);

UPDATE public.categories SET category_type = 'savings' 
WHERE name ILIKE ANY (ARRAY['%saving%', '%invest%', '%emergency%', '%retirement%', '%mutual%', '%stock%']);

-- Comment for documentation
COMMENT ON COLUMN public.categories.category_type IS 'Category classification: needs (essential), wants (discretionary), savings (investments/savings)';