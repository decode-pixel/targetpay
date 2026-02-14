

# Build Mode System, Premium Gating, and Mock Testing

## ✅ COMPLETED

### 1. Two-Mode System (Simple / Advanced)
- `src/contexts/ModeContext.tsx` — localStorage-based mode toggle
- `src/components/mode/ModeToggle.tsx` — pill-shaped toggle in header
- Added to `AppLayout.tsx` header next to ThemeToggle
- Both modes are 100% free

### 2. Subscription/Payment Cleanup
- Deleted `src/hooks/useSubscription.ts`
- Deleted `src/components/mode/PremiumGate.tsx` and `UpgradeModal.tsx`
- Deleted `src/pages/Pricing.tsx`
- Deleted Stripe edge functions (create-checkout, customer-portal, stripe-webhook)
- Dropped `subscriptions` table
- Fixed MobileNav to remove Premium tab (replaced with Profile)

### 3. Dashboard Mode-Aware
- Dashboard shows upgrade banner in Simple mode promoting AI Pro (free)
- Full dashboard available in both modes

### 4. PDF Fixes
- Increased timeout to 10 minutes in both edge function and frontend
- Fixed `statement_imports` status constraint to include `password_required`

## 🔜 REMAINING

### 5. Security: Fix Anonymous Access RLS Policies
- All tables have RLS policies allowing anonymous access (should be `authenticated` role only)

### 6. Additional Features (Future)
- Goal Tracking page with circular progress indicators
- Recurring Expense detector
- Apple-inspired liquid glass UI refinements
