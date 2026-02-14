import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user } = useAuth();

  const [isMockMode, setIsMockMode] = useState(() => {
    return localStorage.getItem('mock_premium_mode') === 'true';
  });

  const toggleMockMode = useCallback((enabled: boolean) => {
    localStorage.setItem('mock_premium_mode', enabled.toString());
    setIsMockMode(enabled);
  }, []);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Subscription | null);
    },
    enabled: !!user,
  });

  // Mock mode override
  if (isMockMode) {
    return {
      subscription: {
        id: 'mock-sub',
        user_id: user?.id || '',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        plan: 'premium',
        status: 'active',
        trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Subscription,
      isLoading: false,
      isPremium: true,
      isTrialing: false,
      trialDaysLeft: 0,
      isMockMode: true,
      toggleMockMode,
    };
  }

  const isPremium = subscription?.plan === 'premium' && 
    ['active', 'trialing'].includes(subscription?.status || '');

  const isTrialing = subscription?.status === 'trialing';

  const trialDaysLeft = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    subscription,
    isLoading,
    isPremium,
    isTrialing,
    trialDaysLeft,
    isMockMode: false,
    toggleMockMode,
  };
}
