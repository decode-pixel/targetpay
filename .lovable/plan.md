

# Mode-Aware System Upgrade

Make the entire app respond instantly to Simple/Pro mode switching. No data deletion, no page reloads, just clean conditional rendering everywhere.

## What Changes

### Dashboard (`src/pages/Dashboard.tsx`)
- **Simple Mode**: Show only DashboardHeader (with stat cards), BudgetAlerts, and Recent Expenses list. Hide all charts (CategoryPieChart, CategoryBarChart, MonthlyTrendChart). Keep the "Try AI Pro" banner.
- **Pro Mode**: Show everything as-is (charts, alerts, trends, recent expenses).

### Expenses (`src/pages/Expenses.tsx`)
- **Simple Mode**: Hide the "Import Statement" button entirely. Users can only add/edit/delete expenses manually and export CSV.
- **Pro Mode**: Show Import Statement button and full import wizard.

### Budgets (`src/pages/Budgets.tsx`)
- **Simple Mode**: Show only the Budgets tab with MonthlyBudgetEditor cards and monthly summary. Hide the Categories and Settings tabs entirely. Hide BudgetHealthScore, BudgetSuggestions, and the smart rules badge/description. Show a simplified header ("Budgets" instead of "Budget Management").
- **Pro Mode**: Show all 3 tabs (Budgets, Categories, Settings), health score, suggestions, CategoryTypeEditor, smart rules badge -- everything as-is.

### Categories (`src/pages/Categories.tsx`)
- No change needed -- manual category add/edit works in both modes. Categories page stays the same.

### Budget Alerts (`src/components/dashboard/BudgetAlerts.tsx`)
- **Simple Mode**: Still show alerts (they're based on manual budgets, not AI). No change needed.

### Import Wizard (`src/components/import/ImportWizardDialog.tsx`)
- No code change needed since the Import button itself is hidden in Simple mode on the Expenses page.

### Mode Toggle (`src/components/mode/ModeToggle.tsx`)
- No change -- already works correctly with sliding indicator.

### Mobile Nav (`src/components/layout/MobileNav.tsx`)
- No change needed -- same nav items for both modes.

## Technical Details

All changes use the existing `useMode()` hook from `src/contexts/ModeContext.tsx`. Each page imports `useMode` and checks `isSimple` / `isAdvanced` to conditionally render sections. No new files, no new dependencies, no database changes.

### Files to Modify
1. **`src/pages/Dashboard.tsx`** -- wrap charts in `{isAdvanced && ...}`
2. **`src/pages/Expenses.tsx`** -- wrap Import button in `{isAdvanced && ...}`
3. **`src/pages/Budgets.tsx`** -- use `isSimple` to hide tabs, health score, suggestions, smart rules UI; simplify header in Simple mode

### What Stays the Same in Both Modes
- Manual expense add/edit/delete
- Manual category add/edit/delete
- Manual monthly budget setting
- Dashboard header with spending stats
- Budget alerts (threshold-based)
- CSV export
- Profile settings
- Theme toggle
- Mode toggle in header

