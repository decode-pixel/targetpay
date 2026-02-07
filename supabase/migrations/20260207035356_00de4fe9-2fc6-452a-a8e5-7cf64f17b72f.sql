-- Add budget alert threshold to categories table
ALTER TABLE public.categories
ADD COLUMN budget_alert_threshold integer NOT NULL DEFAULT 80;

-- Add check constraint to ensure threshold is between 0 and 100
ALTER TABLE public.categories
ADD CONSTRAINT budget_alert_threshold_range CHECK (budget_alert_threshold >= 0 AND budget_alert_threshold <= 100);

-- Add comment for documentation
COMMENT ON COLUMN public.categories.budget_alert_threshold IS 'Percentage threshold (0-100) at which to show budget alerts';