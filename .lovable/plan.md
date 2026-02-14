

# Add INR Pricing & Subscription System

## Overview
Create a pricing page and subscription system with plans in Indian Rupees (INR). The app already uses INR throughout, so this fits naturally. Stripe needs to be enabled first, then we build the pricing page and checkout flow.

## Pricing Plans (after 7-day free trial)

| Plan | Price | Savings |
|------|-------|---------|
| 1 Month | ₹19/month | — |
| 3 Months | ₹49 (₹16.3/mo) | ~14% off |
| 6 Months | ₹89 (₹14.8/mo) | ~22% off |
| 1 Year | ₹149 (₹12.4/mo) | ~35% off |

All plans include a 7-day free trial.

## Implementation Steps

### Step 1: Enable Stripe
- Connect the Stripe integration to the project
- This is required before any payment code can be written

### Step 2: Create Database Table
- Add a `subscriptions` table with columns: `id`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan` (free/premium), `status` (active/trialing/canceled/past_due), `trial_end`, `current_period_end`, `created_at`, `updated_at`
- Add RLS policies so users can only read their own subscription

### Step 3: Create Edge Functions
- **create-checkout**: Creates a Stripe Checkout session with the selected plan and 7-day trial, prices in INR
- **stripe-webhook**: Handles Stripe events (subscription created, updated, canceled, payment failed) and syncs status to the `subscriptions` table
- **customer-portal**: Redirects users to Stripe's billing portal to manage/cancel

### Step 4: Build Pricing Page
- New `/pricing` route
- Plan comparison cards showing all 4 tiers with INR prices
- Highlight best value (1 Year plan)
- "Start 7-Day Free Trial" CTA on each plan
- Feature comparison: Simple (free) vs Premium

### Step 5: Add Subscription Hook
- Create `useSubscription` hook that queries the `subscriptions` table
- Returns current plan, status, trial info
- Used by components to gate premium features

### Step 6: Wire Up Navigation
- Add Pricing link in navigation
- Add upgrade prompts where premium features are gated
- Update `App.tsx` with the `/pricing` route

## Technical Details

- Stripe prices created in INR (currency: "inr")
- All 4 plans configured as recurring subscriptions with appropriate intervals
- Webhook validates Stripe signature before processing
- Subscription status checked client-side via the `useSubscription` hook
- The existing app already formats currency in INR, so no currency display changes needed

## Files to Create/Modify
- **New**: `src/pages/Pricing.tsx`
- **New**: `src/hooks/useSubscription.ts`
- **New**: `supabase/functions/create-checkout/index.ts`
- **New**: `supabase/functions/stripe-webhook/index.ts`
- **New**: `supabase/functions/customer-portal/index.ts`
- **New**: Database migration for `subscriptions` table
- **Modified**: `src/App.tsx` (add route)
- **Modified**: `src/components/layout/MobileNav.tsx` (add nav link)

