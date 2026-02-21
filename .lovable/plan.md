

# TargetPay Full Review & Fix Plan

## Overview

After thorough code review, I've identified the following issues to fix across 4 areas: PDF extraction, authentication, edge function stability, and general UI/code quality.

---

## 1. PDF Import & AI Extraction (Critical Fix)

**Problem:** The current `extractTextFromPDF` function uses a naive regex-based BT/ET stream parser that fails on most real-world PDFs. Modern PDFs use compressed streams (FlateDecode), CID fonts, and content streams that this regex approach cannot read, resulting in empty text and the "Failed to extract transactions" error.

**Fix:** Replace the broken regex extractor with a robust approach using `pdf-lib` (already imported) to get page count, combined with sending the raw PDF bytes as base64 directly to GPT-4o via Bytez. GPT-4o natively handles document understanding when given base64 content. Since Bytez proxies OpenAI, it should support the `image_url` content type with `data:application/pdf;base64,...` format.

**If Bytez does not support PDF via image_url:** Fall back to using a Deno-compatible PDF text extraction library. The most reliable option for Deno is `https://esm.sh/pdf-parse@1.1.1` which is a pure JS parser without worker dependencies.

**Changes to `supabase/functions/parse-bank-statement/index.ts`:**
- Remove the broken `extractTextFromPDF` regex function
- Add `arrayBufferToBase64` helper
- Update `callAI` to send PDF bytes as base64 in a multipart message (text + image_url with PDF data URI)
- For chunked processing, split PDF using pdf-lib (already working), convert each chunk to base64, and send to AI
- Add a fallback: if the base64 approach returns an error (unsupported media type), try `pdf-parse` for text extraction
- Keep all error handling, retry logic, and chunking intact

## 2. Authentication Fix

**Problem:** After reviewing the auth code, the implementation looks correct:
- `AuthContext` properly sets up `onAuthStateChange` before `getSession`
- Google OAuth uses `lovable.auth.signInWithOAuth`
- Protected routes redirect to `/auth` when no user

**Potential issues to verify and fix:**
- The `vite.config.ts` has hardcoded `define` values which is correct for the build
- PWA config: Check if `vite-plugin-pwa` is configured and if `/~oauth` is in `navigateFallbackDenylist` (required for OAuth to work)

**Changes:**
- Check `vite.config.ts` for PWA plugin config and add `navigateFallbackDenylist: [/^\/~oauth/]` if VitePWA is used
- No other auth changes needed based on code review -- the auth implementation follows best practices

## 3. Edge Functions Standardization (Bytez GPT-4o)

**Current state:** All 3 edge functions (`budget-insights`, `categorize-transactions`, `parse-bank-statement`) already use Bytez GPT-4o exclusively. No Lovable AI dependencies remain. This is confirmed and correct.

**Minor improvements:**
- Add better error logging in `parse-bank-statement` to capture the exact failure point
- Ensure `BYTEZ_API_KEY` secret is verified accessible

## 4. General Bug Fixes & UI

**After code review, the following are confirmed working:**
- Expense CRUD (add/edit/delete) via `useExpenses` hooks
- Category CRUD via `useCategories` hooks  
- Budget rules & slider reaction via `useBudgetRules` + `useFinancialSettings`
- Dashboard totals & charts (StatCards, PieChart, BarChart, TrendChart)
- Mode switch (Simple/Pro) via `ModeContext` with localStorage persistence
- CSV export via `exportSheet.ts`
- Profile save & refresh via `useProfile` hooks
- Navigation & mobile UI via `AppLayout` + `MobileNav`

**No broken patterns found** in the React/hooks layer. All hooks properly use TanStack Query with cache invalidation.

---

## Technical Implementation Details

### File: `supabase/functions/parse-bank-statement/index.ts`

1. Remove lines 143-177 (broken `extractTextFromPDF` regex function)
2. Add `arrayBufferToBase64` helper function
3. Modify `callAI` to accept either text string or base64 PDF bytes:
   - When given base64 bytes, send as multipart content with `image_url` type using `data:application/pdf;base64,...`
   - When text extraction fallback is needed, send as plain text (current behavior)
4. Update small PDF path (line 380-403): send base64 bytes directly to AI instead of extracting text first
5. Update chunked processing path (line 436-442): send chunk base64 bytes directly
6. Add fallback: if AI returns an error about unsupported format, attempt text extraction using `pdf-parse` library and retry

### File: `vite.config.ts`

1. Check if VitePWA plugin is configured; if so, ensure `navigateFallbackDenylist` includes `/~oauth`

### Edge Function Redeployment

All 4 edge functions will be redeployed:
- `parse-bank-statement` (major fix)
- `budget-insights` (redeploy for sync)
- `categorize-transactions` (redeploy for sync)
- `import-transactions` (redeploy for sync)

### Verification Steps

After implementation:
1. Test auth login/signup flow
2. Test PDF upload and AI extraction
3. Verify dashboard loads with data
4. Verify expense add/edit/delete
5. Verify category management
6. Verify budget slider reactions
7. Verify CSV export
8. Verify profile save

