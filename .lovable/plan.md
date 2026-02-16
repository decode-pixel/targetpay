
# Make Budget Mode (Flexible/Guided/Strict) Actually Work

Currently, the Rule Enforcement setting (flexible/guided/strict) is stored in the database but has no effect on the app. Changing it does nothing visible. This plan makes each mode behave differently across the entire system with live preview.

---

## How Each Mode Will Behave

| Behavior | Flexible | Guided | Strict |
|----------|----------|--------|--------|
| Over-budget warning | None | Yellow warning banner | Red blocking alert |
| Adding expense over budget | Always allowed | Allowed with warning toast | Requires "Override" confirmation |
| Budget allocation sliders | Free adjustment | Soft warning if outside 50/30/20 | Locked to 50/30/20 ratios |
| Health score deductions | Light (-5 per violation) | Medium (-10 per violation) | Heavy (-15 per violation) |
| Suggestions tone | Tips only | Warnings + tips | Urgent warnings |
| Budget card styling | Normal | Orange border when near limit | Red border + shake when over |

---

## Changes by File

### 1. `src/components/budget/FinancialSettingsCard.tsx` -- Live Preview on Mode Change

- When user clicks Flexible/Guided/Strict, immediately show a **live preview card** below the selector showing:
  - Mode name with icon
  - 3-4 bullet points describing what this mode does
  - Animated allocation bar showing Needs/Wants/Savings split
- In **Strict** mode: lock the percentage sliders to fixed 50/30/20 values (disable sliders, auto-set values)
- In **Guided** mode: show a warning badge if percentages deviate more than 10% from 50/30/20
- In **Flexible** mode: no restrictions on sliders
- Auto-save mode change immediately (like Smart Rules toggle already does)

### 2. `src/hooks/useBudgetRules.ts` -- Mode-Aware Suggestions & Health Score

- Import `budgetMode` from financial settings into the rules engine
- Adjust health score deductions based on mode:
  - Flexible: -5 per over-budget category
  - Guided: -10 per over-budget category
  - Strict: -15 per over-budget category
- Adjust suggestion severity based on mode:
  - Flexible: only show at 90% and 100% thresholds
  - Guided: show at 70%, 90%, 100% (current behavior)
  - Strict: show at 50%, 70%, 90%, 100% -- with stronger wording
- Add a new suggestion type for strict mode: "Budget violation" (instead of just "warning")

### 3. `src/components/expenses/ExpenseFormDialog.tsx` -- Enforce Rules on Expense Entry

- Fetch financial settings and category budgets
- After user fills amount and selects category, check if this expense would exceed the category budget:
  - **Flexible**: No check, submit normally
  - **Guided**: Show a yellow warning toast ("This will exceed your Food budget by X") but allow submission
  - **Strict**: Show a confirmation AlertDialog: "This expense exceeds your budget by X. Are you sure you want to override?" with "Cancel" and "Override & Save" buttons

### 4. `src/components/categories/MonthlyBudgetEditor.tsx` -- Visual Mode Feedback

- Accept `budgetMode` as a prop (or fetch from settings)
- Adjust the budget card border/styling based on mode and usage:
  - **Guided**: Orange border + warning icon when usage > 80%
  - **Strict**: Red border + pulse animation when over 100%; show a "LOCKED" badge if budget is over and strict mode prevents further spending
- Show the mode badge on each card (small "Guided" or "Strict" pill)

### 5. `src/components/budget/BudgetHealthScore.tsx` -- Mode Label

- Show the active mode name as a badge next to "Budget Health" title (e.g., "Strict Mode")
- Adjust score color thresholds based on mode (strict mode is harder to get "Excellent")

### 6. `src/components/dashboard/BudgetAlerts.tsx` -- Mode-Aware Alerts

- Adjust alert thresholds based on budget mode:
  - **Flexible**: Only show alerts at 100% (over budget)
  - **Guided**: Show at threshold (current behavior, default 80%)
  - **Strict**: Show at 50% (early warning) and stronger language at 80%+
- In strict mode, mark over-budget alerts as "VIOLATION" instead of just a warning

### 7. `src/pages/Budgets.tsx` -- Pass Mode Down

- Pass `budgetMode` from financial settings to child components that need it
- Show a colored banner at top of Budgets tab indicating active mode with description

---

## Technical Details

### No Database Changes Needed
The `budget_mode` column already exists in `user_financial_settings` table and stores 'flexible', 'guided', or 'strict'.

### Data Flow

The `useFinancialSettings` hook already returns `budget_mode`. Components will read it from there. The mode change in `FinancialSettingsCard` will auto-save (like the Smart Rules toggle) and invalidate the query, causing all components to re-render with the new mode.

### Files to Modify
- `src/components/budget/FinancialSettingsCard.tsx` -- live preview + slider locking
- `src/hooks/useBudgetRules.ts` -- mode-aware scoring and suggestions
- `src/components/expenses/ExpenseFormDialog.tsx` -- enforce rules on submit
- `src/components/categories/MonthlyBudgetEditor.tsx` -- visual mode feedback
- `src/components/budget/BudgetHealthScore.tsx` -- mode badge + adjusted thresholds
- `src/components/dashboard/BudgetAlerts.tsx` -- mode-aware alert thresholds
- `src/pages/Budgets.tsx` -- mode banner + prop passing

### No New Dependencies
All changes use existing UI components (AlertDialog, Badge, toast, etc.).
