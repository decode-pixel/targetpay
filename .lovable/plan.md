

# Build Mode System, Premium Gating, and Mock Testing

This plan implements the core two-mode system (Simple/Advanced), mock premium testing, premium feature gating, and the upgrade flow -- all without needing a Stripe key.

## What Gets Built

### 1. Mock Premium Toggle in useSubscription
Update `src/hooks/useSubscription.ts` to add localStorage-based mock premium mode. Returns `isMockMode` and `toggleMockMode` alongside real subscription data. When mock mode is active, it overrides the real subscription query to return premium status.

### 2. Mode Context (Simple / Advanced)
Create `src/contexts/ModeContext.tsx` that persists mode choice to localStorage. Provides `mode`, `isSimple`, `isAdvanced`, and `toggleMode`. When toggling to Advanced, checks `isPremium` -- if not premium, shows upgrade prompt instead.

### 3. Mode Toggle Component
Create `src/components/mode/ModeToggle.tsx` -- a pill-shaped toggle in the header (top-right area next to ThemeToggle). Shows "Simple" and "AI Pro" with a sliding indicator. Locked icon shown for non-premium users trying Advanced.

### 4. PremiumGate Component
Create `src/components/mode/PremiumGate.tsx` -- wraps premium-only content. Shows a styled upgrade prompt with feature name when user isn't premium. Used to gate features like custom categories, AI budget planning, encrypted PDF uploads, etc.

### 5. Upgrade Modal
Create `src/components/mode/UpgradeModal.tsx` -- a dialog listing premium features with a CTA. In dev/mock mode, offers "Activate Test Mode" button. Otherwise navigates to `/pricing`.

### 6. Developer Settings Panel
Add a dev-only section to `src/pages/Profile.tsx` (visible when `import.meta.env.DEV` or `?dev=true` URL param) with a toggle to activate mock premium mode.

### 7. Feature Gating on Pages
- **Dashboard**: Show full dashboard always (it already works for both modes), but add an upgrade banner at the bottom for Simple mode users promoting Advanced features.
- **Categories**: In Simple mode, hide the "Add Category" button and show a PremiumGate note that custom categories require Advanced mode. Users see only their existing pre-defined categories.
- **Budgets**: Gate the Smart Rules (BudgetHealthScore, BudgetSuggestions, CategoryTypeEditor) behind PremiumGate when in Simple mode.
- **Expenses / Import**: In Simple mode, limit PDF import to 100 transactions and block encrypted PDFs with a PremiumGate message.

### 8. Navigation Updates
- Add ModeToggle to `AppLayout.tsx` header (next to ThemeToggle)
- Add mock mode indicator banner at top of app when active

## Files to Create
- `src/contexts/ModeContext.tsx`
- `src/components/mode/ModeToggle.tsx`
- `src/components/mode/PremiumGate.tsx`
- `src/components/mode/UpgradeModal.tsx`

## Files to Modify
- `src/hooks/useSubscription.ts` -- add mock mode logic
- `src/components/layout/AppLayout.tsx` -- add ModeToggle + mock indicator
- `src/pages/Profile.tsx` -- add developer settings section
- `src/pages/Categories.tsx` -- gate custom category creation
- `src/pages/Budgets.tsx` -- gate smart rules features
- `src/components/import/ImportWizardDialog.tsx` -- gate encrypted PDFs and limit transactions in Simple mode
- `src/App.tsx` -- wrap with ModeProvider

## Technical Notes
- No database changes needed -- mode stored in localStorage for simplicity
- No new dependencies required
- Dark mode already works via next-themes ThemeToggle
- Recharts already installed for charts
- All gating is client-side via the `useSubscription` and `useMode` hooks

