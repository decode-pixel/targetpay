import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Crown, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';

const plans = [
  {
    id: '1_month',
    name: '1 Month',
    price: 19,
    period: '/month',
    description: 'Get started with Premium',
    perMonth: 19,
    savings: null,
  },
  {
    id: '3_months',
    name: '3 Months',
    price: 49,
    period: '/3 months',
    description: 'Save ~14%',
    perMonth: 16.3,
    savings: '~14% off',
  },
  {
    id: '6_months',
    name: '6 Months',
    price: 89,
    period: '/6 months',
    description: 'Save ~22%',
    perMonth: 14.8,
    savings: '~22% off',
    popular: true,
  },
  {
    id: '1_year',
    name: '1 Year',
    price: 149,
    period: '/year',
    description: 'Best value — save ~35%',
    perMonth: 12.4,
    savings: '~35% off',
  },
];

const freeFeatures = [
  'Manual transaction entry',
  'Basic categories (8 pre-defined)',
  'Simple dashboard',
  'PDF upload (100 transactions)',
  'Monthly summary',
  'CSV export',
];

const premiumFeatures = [
  'Everything in Free',
  'AI Budget Planning',
  'Unlimited PDF uploads (1000+)',
  'Password-protected PDF support',
  'Custom categories & sub-categories',
  'Advanced analytics & reports',
  'Recurring expense tracking',
  'Goal tracking',
  'Multi-currency support',
  'Priority support',
  'Export to PDF/Excel',
  'Unlimited history',
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, isPremium, isTrialing, trialDaysLeft, isLoading } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const handleCheckout = async (planId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoadingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('create-checkout', {
        body: { planId },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);
      const { url } = response.data;
      if (url) window.location.href = url;
    } catch (error: any) {
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('customer-portal', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);
      const { url } = response.data;
      if (url) window.location.href = url;
    } catch (error: any) {
      toast.error(error.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Upgrade to Premium</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Unlock AI-powered budgeting, unlimited PDF imports, and advanced analytics. 
            Start with a <span className="font-semibold text-primary">7-day free trial</span>.
          </p>
        </div>

        {/* Status Messages */}
        {success && (
          <Card className="border-accent/50 bg-accent/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Check className="h-5 w-5 text-accent" />
              <span className="font-medium">Welcome to Premium! Your 7-day free trial has started.</span>
            </CardContent>
          </Card>
        )}
        {canceled && (
          <Card className="border-muted/50 bg-muted/5">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Checkout was canceled. You can try again anytime.
            </CardContent>
          </Card>
        )}

        {/* Current Plan Status */}
        {isPremium && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">You're on Premium</p>
                  {isTrialing && (
                    <p className="text-sm text-muted-foreground">
                      Trial: {trialDaysLeft} days remaining
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage Subscription'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative transition-all hover:shadow-lg ${
                plan.popular ? 'border-primary shadow-md ring-1 ring-primary/20' : 'border-border/50'
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">₹{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{plan.perMonth}/month
                </p>
                {plan.savings && (
                  <Badge variant="secondary" className="mt-2 text-xs">{plan.savings}</Badge>
                )}
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleCheckout(plan.id)}
                  disabled={!!loadingPlan || isPremium}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPremium ? (
                    'Current Plan'
                  ) : (
                    'Start Free Trial'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feature Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Free</CardTitle>
              <p className="text-sm text-muted-foreground">Basic expense tracking</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {freeFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Premium</CardTitle>
                <Crown className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Full financial management</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {premiumFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">How does the 7-day free trial work?</p>
              <p className="text-muted-foreground mt-1">
                You get full Premium access for 7 days. Cancel anytime before the trial ends and you won't be charged.
              </p>
            </div>
            <div>
              <p className="font-medium">Can I change plans later?</p>
              <p className="text-muted-foreground mt-1">
                Yes! You can upgrade, downgrade, or cancel through the billing portal anytime.
              </p>
            </div>
            <div>
              <p className="font-medium">What happens if I cancel?</p>
              <p className="text-muted-foreground mt-1">
                You keep Premium until the end of your billing period. Your data is always safe and accessible on the Free plan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
