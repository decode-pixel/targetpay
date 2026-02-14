-- Fix all RLS policies to use TO authenticated instead of allowing anonymous access

-- categories
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can create their own categories" ON public.categories;

CREATE POLICY "Users can view their own categories" ON public.categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON public.categories FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categories" ON public.categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- category_budgets
DROP POLICY IF EXISTS "Users can delete their own category budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Users can update their own category budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Users can view their own category budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Users can create their own category budgets" ON public.category_budgets;

CREATE POLICY "Users can view their own category budgets" ON public.category_budgets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own category budgets" ON public.category_budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own category budgets" ON public.category_budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own category budgets" ON public.category_budgets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- category_mappings
DROP POLICY IF EXISTS "Users can delete their own category mappings" ON public.category_mappings;
DROP POLICY IF EXISTS "Users can update their own category mappings" ON public.category_mappings;
DROP POLICY IF EXISTS "Users can view their own category mappings" ON public.category_mappings;
DROP POLICY IF EXISTS "Users can create their own category mappings" ON public.category_mappings;

CREATE POLICY "Users can view their own category mappings" ON public.category_mappings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own category mappings" ON public.category_mappings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own category mappings" ON public.category_mappings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own category mappings" ON public.category_mappings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- expense_drafts
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.expense_drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.expense_drafts;
DROP POLICY IF EXISTS "Users can view their own drafts" ON public.expense_drafts;
DROP POLICY IF EXISTS "Users can create their own drafts" ON public.expense_drafts;

CREATE POLICY "Users can view their own drafts" ON public.expense_drafts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own drafts" ON public.expense_drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own drafts" ON public.expense_drafts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own drafts" ON public.expense_drafts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- expenses
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;

CREATE POLICY "Users can view their own expenses" ON public.expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- extracted_transactions
DROP POLICY IF EXISTS "Users can delete their own extracted transactions" ON public.extracted_transactions;
DROP POLICY IF EXISTS "Users can update their own extracted transactions" ON public.extracted_transactions;
DROP POLICY IF EXISTS "Users can view their own extracted transactions" ON public.extracted_transactions;
DROP POLICY IF EXISTS "Users can create their own extracted transactions" ON public.extracted_transactions;

CREATE POLICY "Users can view their own extracted transactions" ON public.extracted_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own extracted transactions" ON public.extracted_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own extracted transactions" ON public.extracted_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own extracted transactions" ON public.extracted_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- statement_imports
DROP POLICY IF EXISTS "Users can delete their own imports" ON public.statement_imports;
DROP POLICY IF EXISTS "Users can update their own imports" ON public.statement_imports;
DROP POLICY IF EXISTS "Users can view their own imports" ON public.statement_imports;
DROP POLICY IF EXISTS "Users can create their own imports" ON public.statement_imports;

CREATE POLICY "Users can view their own imports" ON public.statement_imports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own imports" ON public.statement_imports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own imports" ON public.statement_imports FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own imports" ON public.statement_imports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_financial_settings
DROP POLICY IF EXISTS "Users can view their own financial settings" ON public.user_financial_settings;
DROP POLICY IF EXISTS "Users can create their own financial settings" ON public.user_financial_settings;
DROP POLICY IF EXISTS "Users can update their own financial settings" ON public.user_financial_settings;

CREATE POLICY "Users can view their own financial settings" ON public.user_financial_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own financial settings" ON public.user_financial_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own financial settings" ON public.user_financial_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- storage.objects - fix remaining anonymous access policies
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own bank statements" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own bank statements" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload bank statements" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload bank statements" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own bank statements" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own bank statements" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'bank-statements' AND auth.uid()::text = (storage.foldername(name))[1]);