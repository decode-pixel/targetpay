-- Add smart_rules_enabled column to user_financial_settings
ALTER TABLE public.user_financial_settings 
ADD COLUMN IF NOT EXISTS smart_rules_enabled BOOLEAN DEFAULT TRUE;

-- Add a comment explaining the column
COMMENT ON COLUMN public.user_financial_settings.smart_rules_enabled IS 'Toggle for smart budget rules - when OFF, app runs in simple mode without AI recommendations';