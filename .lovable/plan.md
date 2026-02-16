

# Fix UI Reactivity: Instant Updates for Profile Save and Budget Mode

## Problems Found

1. **Profile Save**: The `useUpdateProfile` hook fires `invalidateQueries` without awaiting it, so the success toast appears before the UI actually refreshes with new data. The `hasChanges` flag also has a stale dependency in the `useEffect` sync.

2. **Budget Mode Selector**: The `useUpdateFinancialSettings` hook only invalidates `financial-settings` queries. It does NOT invalidate downstream queries that depend on settings (budget rules, category budgets, expenses). This means the dashboard, health score, alerts, and budget cards all show stale values until the user manually navigates away and back.

---

## Fix 1: `src/hooks/useProfile.ts` -- Await Invalidation, Then Toast

Change `onSuccess` to an async function that awaits `invalidateQueries` before showing the toast:

```typescript
onSuccess: async () => {
  await queryClient.invalidateQueries({ queryKey: ['profile'] });
  toast.success('Profile updated');
},
```

This ensures the profile query refetches and updates the UI BEFORE the success message appears.

## Fix 2: `src/pages/Profile.tsx` -- Reset hasChanges Properly

The `useEffect` that syncs `fullName` from profile data skips when `hasChanges` is true, but after a successful save `hasChanges` is reset in `handleSave` -- however the timing can race. Fix by resetting `hasChanges` inside `onSuccess` of the mutation, or by using `onSettled`. The current approach in `handleSave` already resets it after `mutateAsync`, which is correct since `mutateAsync` awaits. No change needed here once the hook awaits properly.

## Fix 3: `src/hooks/useFinancialSettings.ts` -- Invalidate All Dependent Queries

Change `onSuccess` in `useUpdateFinancialSettings` to await invalidation of ALL dependent query keys:

```typescript
onSuccess: async () => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['financial-settings'] }),
    queryClient.invalidateQueries({ queryKey: ['categories'] }),
    queryClient.invalidateQueries({ queryKey: ['expenses'] }),
    queryClient.invalidateQueries({ queryKey: ['category-budgets'] }),
  ]);
  toast.success('Settings saved');
},
```

This ensures that when the user switches between Flexible/Guided/Strict:
- Budget health score recalculates immediately
- Budget alerts update thresholds instantly
- Category budget cards re-render with correct styling
- Dashboard stat cards reflect the new mode

## Fix 4: `src/components/budget/FinancialSettingsCard.tsx` -- Optimistic Local State

The `handleModeChange` function already updates local state (`setBudgetMode`) before calling `mutateAsync`, which is correct for instant visual feedback on the live preview card. No change needed here -- the fix is in the hook's `onSuccess` propagating changes to other components.

---

## Summary of File Changes

| File | Change |
|------|--------|
| `src/hooks/useProfile.ts` | Await `invalidateQueries` before toast in `onSuccess` |
| `src/hooks/useFinancialSettings.ts` | Await invalidation of `financial-settings`, `categories`, `expenses`, `category-budgets` in `onSuccess` |

Two files modified. No new files. No database changes. No new dependencies.

