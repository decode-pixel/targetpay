import { useState, ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradeModal from './UpgradeModal';

interface PremiumGateProps {
  children?: ReactNode;
  feature?: string;
  fallback?: ReactNode;
  compact?: boolean;
}

export default function PremiumGate({ children, feature = 'This feature', fallback, compact = false }: PremiumGateProps) {
  const { isPremium } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (isPremium) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground flex-1">
            {feature} requires <span className="font-medium text-foreground">AI Pro</span> mode.
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowUpgrade(true)} className="shrink-0 gap-1">
            <Sparkles className="h-3 w-3" />
            Upgrade
          </Button>
        </div>
        <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
      </>
    );
  }

  return (
    <>
      <Card className="border-border/50 border-dashed">
        <CardContent className="py-8 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Premium Feature</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {feature} is available with AI Pro mode.
            </p>
          </div>
          <Button onClick={() => setShowUpgrade(true)} className="gap-2 mt-1">
            <Sparkles className="h-4 w-4" />
            Upgrade to Premium
          </Button>
        </CardContent>
      </Card>
      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </>
  );
}
