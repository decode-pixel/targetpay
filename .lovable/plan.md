

# UX, Performance, and Feature Upgrades for TargetPay

Improvements across authentication, validation, performance, mobile UX, and dashboard usability. No changes to already-fixed bugs.

---

## 1. Password Reset Flow

**Files**: `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx` (new), `src/App.tsx`

- Add a "Forgot Password?" link below the Sign In password field
- Add `handleForgotPassword` function that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Validate email before sending (show error if empty/invalid)
- Show success toast: "Check your email for a password reset link"
- Create new `/reset-password` page that:
  - Detects `type=recovery` in URL hash
  - Shows a "Set New Password" form with confirm field
  - Calls `supabase.auth.updateUser({ password })`
  - Redirects to `/` on success
- Add route in `App.tsx`: `<Route path="/reset-password" element={<ResetPassword />} />`

---

## 2. Expense Amount Validation

**File**: `src/components/expenses/ExpenseFormDialog.tsx`

- Add validation in `handleSubmit` before processing:
  - If `parseFloat(amount) <= 0` or `isNaN(parseFloat(amount))`, show inline error "Amount must be greater than zero" and return
- Add `amountError` state, clear it on amount change
- Show error text below the amount input field
- Also update the submit button disabled condition: `disabled={isSubmitting || !amount || parseFloat(amount) <= 0}`

---

## 3. Import Wizard Close Confirmation

**File**: `src/components/import/ImportWizardDialog.tsx`

- Add `showCloseConfirm` state (boolean)
- Replace direct `onOpenChange` with a wrapper function:
  - If wizard is in progress (state is not `idle` and not `error`), show an AlertDialog: "Import in progress. Are you sure you want to close? Unsaved data will be lost."
  - On confirm: call `handleCancel()` (already handles cleanup)
  - On cancel: dismiss alert
- Apply this wrapper to both Dialog and Drawer `onOpenChange` props

---

## 4. Dashboard Add-Expense Button in Simple Mode

**File**: `src/pages/Dashboard.tsx`

- Import `FloatingAddButton` and `useIsMobile`
- Add a floating add button for mobile users (both modes) at the bottom of the page
- For desktop Simple mode users, add an "Add Expense" button in the Recent Expenses card header (next to "View all")
- The button opens the existing `ExpenseFormDialog`

---

## 5. Dashboard Empty State Improvement

**File**: `src/pages/Dashboard.tsx`

- Replace the plain text "No expenses this month" with a richer empty state:
  - Show a `Receipt` icon in a rounded muted circle
  - "No expenses this month" heading
  - "Tap + to add your first expense" subtitle
  - Reuses the same pattern already in `ExpenseList.tsx`

---

## 6. Mode Toggle Labels on Mobile

**File**: `src/components/mode/ModeToggle.tsx`

- Remove `hidden sm:inline` from the label spans so "Simple" and "AI Pro" are always visible
- Adjust button padding slightly for mobile to accommodate text

---

## 7. Export Button Label on Mobile

**File**: `src/pages/Expenses.tsx`

- The Export Sheet button currently hides label text on mobile (only shows icon). Change to always show a short label:
  - Show "Export" on mobile (instead of hidden)
  - Show "Export Sheet" on desktop (keep as-is)

---

## 8. Performance: Remove Duplicate Queries

**Files**: `src/pages/Dashboard.tsx`, `src/components/dashboard/DashboardHeader.tsx`, `src/components/dashboard/StatCards.tsx`

Both `DashboardHeader` and `StatCards` independently call `useExpenses`, `useCategories`, and `useAllEffectiveBudgets` with the same parameters. Since `Dashboard.tsx` already calls `useExpenses` and `useCategories`, refactor to pass data as props:

- `Dashboard.tsx` becomes the single source: calls `useExpenses`, `useCategories`, and `useAllEffectiveBudgets`
- Pass `expenses`, `categories`, and `effectiveBudgets` as props to `DashboardHeader`
- Remove `StatCards` component entirely (its data is already shown in `DashboardHeader`'s stat cards). `StatCards` is not rendered anywhere in Dashboard currently anyway.
- This eliminates 4 duplicate queries per page load

Note: TanStack Query does deduplicate identical queries within the same render cycle, but having the data flow via props is cleaner architecture and prevents accidental mismatches.

---

## 9. Performance: Reduce Google Fonts

**File**: `src/index.css`

- Remove unused font imports (lines 1-3, 5-6): Lato, EB Garamond, Fira Code, Lora, Space Mono
- Keep only Inter (line 4) which is the actual app font
- This eliminates 5 unnecessary network requests on page load

---

## 10. Import Select-All Batch Optimization

**File**: `src/components/import/ImportWizardDialog.tsx`

- Currently `handleSelectAll` calls `updateTransaction.mutate()` once per transaction in a loop, which fires N individual network requests
- Replace with a single batch approach: collect all IDs, then call a single RPC or loop with Promise.all but with a debounce/batch
- Since there's no batch RPC available, use `Promise.all` with the existing mutation but skip individual toasts, and only show one success/error at the end
- Better approach: just update local state immediately (already done), and defer the DB sync to when the user proceeds to the next step (categorize/import), since the `handleImport` function already sends final selections

---

## Summary of Files

| # | Change | Files |
|---|--------|-------|
| 1 | Password reset flow | `Auth.tsx`, new `ResetPassword.tsx`, `App.tsx` |
| 2 | Amount validation | `ExpenseFormDialog.tsx` |
| 3 | Import close confirmation | `ImportWizardDialog.tsx` |
| 4 | Dashboard add button | `Dashboard.tsx` |
| 5 | Dashboard empty state | `Dashboard.tsx` |
| 6 | Mode toggle labels | `ModeToggle.tsx` |
| 7 | Export button label | `Expenses.tsx` |
| 8 | Remove duplicate queries | `Dashboard.tsx`, `DashboardHeader.tsx` |
| 9 | Remove unused fonts | `index.css` |
| 10 | Batch select-all | `ImportWizardDialog.tsx` |

No database migrations needed. No new dependencies.

