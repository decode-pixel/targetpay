

# Fix All Critical Bugs in TargetPay

Fixing 8 identified bugs without adding new features. Only stability and correctness improvements.

---

## 1. Fix Profile State Sync (Profile.tsx)

**Bug**: Line 29 uses `useState(() => { ... })` which is an incorrect pattern -- it runs the callback as a lazy initializer once, not as an effect. Profile name won't sync after initial load.

**Fix**: Replace the incorrect `useState` call and the conditional state sync (lines 29-35) with a proper `useEffect` that sets `fullName` whenever `profile` data changes.

```
useEffect(() => {
  if (profile && !hasChanges) {
    setFullName(profile.full_name || '');
  }
}, [profile]);
```

Remove the `if (profile && !hasChanges && fullName !== ...)` block at line 34-36.

---

## 2. Fix Navigate-During-Render (4 pages)

**Bug**: `navigate('/auth')` is called directly in the render body of Dashboard.tsx (line 51), Expenses.tsx (line 99), Categories.tsx, and Budgets.tsx (line 71). This triggers React warnings and potential render loops.

**Fix**: In each file, replace the bare `if (!user) { navigate('/auth'); return null; }` block with a `useEffect`:

```
useEffect(() => {
  if (!loading && !user) {
    navigate('/auth');
  }
}, [user, loading, navigate]);

if (!user) return null;
```

Files: `Dashboard.tsx`, `Expenses.tsx`, `Categories.tsx`, `Budgets.tsx`

---

## 3. Fix Dashboard Budget Calculation (DashboardHeader.tsx)

**Bug**: Line 24 sums `cat.monthly_budget` (the default) instead of using month-specific `category_budgets`. This causes the dashboard header totals to differ from StatCards which correctly uses `useAllEffectiveBudgets`.

**Fix**: Import and use `useAllEffectiveBudgets` from `useCategoryBudgets.ts` in DashboardHeader, exactly like StatCards does:

```
const { budgets: effectiveBudgets } = useAllEffectiveBudgets(selectedMonth, categories);

// In stats calculation:
let totalBudget = 0;
categories.forEach(cat => {
  totalBudget += effectiveBudgets.get(cat.id) || 0;
});
```

---

## 4. Fix Export Description Column (exportSheet.ts)

**Bug**: Line 60 uses `e.note || '-'` for the Description column, losing category context when note is empty.

**Fix**: Build a smarter description:
```
const catName = e.category?.name || 'Uncategorized';
const description = e.note ? `${e.note} (${catName})` : catName;
```

---

## 5. Fix Import Wizard Select-All Stale Closure (ImportWizardDialog.tsx)

**Bug**: Line 314 reads `localTransactions` inside `handleSelectAll` but it's in the dependency array, creating stale closure issues on rapid toggles.

**Fix**: Use a ref to avoid stale closure:
```
const localTransactionsRef = useRef(localTransactions);
localTransactionsRef.current = localTransactions;

const handleSelectAll = useCallback((selected: boolean) => {
  setLocalTransactions(prev => prev.map(t => ({ ...t, is_selected: selected })));
  localTransactionsRef.current.forEach(t => 
    updateTransaction.mutate({ id: t.id, is_selected: selected })
  );
}, [updateTransaction]);
```

---

## 6. Fix Mobile Navigation -- Add Categories Tab (MobileNav.tsx)

**Bug**: Categories page has no entry in the mobile bottom nav, making it inaccessible on mobile.

**Fix**: Add a Categories nav item (using `Grid3X3` or `LayoutGrid` icon) between Expenses and Budgets. Adjust the 4-item layout to 5 items:

```
const navItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/categories', label: 'Categories', icon: LayoutGrid },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/profile', label: 'Profile', icon: User },
];
```

---

## 7. Fix Export Freeze Pane (exportSheet.ts)

**Bug**: `ws['!freeze']` is not a valid SheetJS property. The header row doesn't actually freeze.

**Fix**: Replace with the correct SheetJS property `!views`:
```
ws['!views'] = [{ state: 'frozen', ySplit: tableHeaderRow + 1 }];
```

Remove the invalid `ws['!freeze']` line.

---

## 8. Fix Avatar Refresh (useProfile.ts)

**Bug**: The signed URL (1 hour expiry) may expire while the app is open, but `staleTime` is 30 minutes. This is mostly fine but the query should also refetch on window focus to handle cases where the user returns to the app after the URL expired.

**Fix**: Add `refetchOnWindowFocus: true` (already default in react-query, but explicitly set it) and reduce `staleTime` to 15 minutes to ensure the URL refreshes before the 1-hour expiry:

```
staleTime: 15 * 60 * 1000, // 15 minutes
refetchOnWindowFocus: true,
```

---

## Summary of Files to Modify

| File | Fix |
|------|-----|
| `src/pages/Profile.tsx` | useEffect for state sync |
| `src/pages/Dashboard.tsx` | useEffect for navigate |
| `src/pages/Expenses.tsx` | useEffect for navigate |
| `src/pages/Categories.tsx` | useEffect for navigate |
| `src/pages/Budgets.tsx` | useEffect for navigate |
| `src/components/dashboard/DashboardHeader.tsx` | useAllEffectiveBudgets |
| `src/lib/exportSheet.ts` | description + freeze pane |
| `src/components/import/ImportWizardDialog.tsx` | ref for selectAll |
| `src/components/layout/MobileNav.tsx` | add Categories tab |
| `src/hooks/useProfile.ts` | staleTime + refetch |

No new files. No database changes. No new dependencies.
