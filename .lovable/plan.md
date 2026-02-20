

# Ready TargetPay for Final Publish

## Current Issue: Blank Screen

The app shows a blank white screen due to a `supabaseUrl is required` error. This happened because the external GitHub sync caused Vite's environment variable cache to become stale. The `.env` file and `client.ts` are both correct, but the build isn't picking up the env vars.

## Fix Plan

### Step 1: Trigger a rebuild by making a trivial change

Since `src/integrations/supabase/client.ts` and `.env` are auto-generated and cannot be edited, the simplest fix is to make a no-op change to any source file (e.g., add a comment to `src/main.tsx`) to force Vite to do a full rebuild and re-read the `.env` file. This is a standard fix after external syncs.

Alternatively, if the env vars are truly missing, I will verify by checking the `.env` contents and ensuring the auto-generated client gets regenerated.

### Step 2: Verify the app loads

After the rebuild triggers, confirm:
- Auth page renders with the TargetPay logo
- No console errors about missing Supabase URL
- Navigation works across all routes

### Step 3: Deploy edge functions

Redeploy all 5 edge functions to ensure they match the latest code:
- `parse-bank-statement`
- `categorize-transactions`
- `import-transactions`
- `budget-insights`

### Step 4: Final verification checklist

- Frontend builds without errors
- Auth flow works (login/signup)
- Dashboard loads with data
- Edge functions respond correctly
- PWA manifest loads properly

## Files to Modify

| File | Change |
|------|--------|
| `src/main.tsx` | Trivial rebuild trigger (add/update comment) |

One minor touch to force rebuild. All edge functions redeployed. No logic changes, no new dependencies, no database changes.

