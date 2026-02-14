import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, Zap, Shield, BarChart3, FileText, Tags, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEATURES = [
  { icon: Brain, label: 'AI Budget Planning' },
  { icon: BarChart3, label: 'Advanced Analytics' },
  { icon: FileText, label: 'Unlimited PDF Uploads' },
  { icon: Shield, label: 'Password-Protected PDFs' },
  { icon: Tags, label: 'Custom Categories' },
  { icon: Zap, label: 'Smart Budget Rules' },
];

export default function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { isMockMode, toggleMockMode } = useSubscription();

  const handleUpgrade = () => {
    if (isMockMode || import.meta.env.DEV) {
      toggleMockMode(true);
      toast.success('🧪 Test Mode Activated — Premium features unlocked!');
      onOpenChange(false);
    } else {
      onOpenChange(false);
      navigate('/pricing');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center items-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-lg">Upgrade to AI Pro</DialogTitle>
          <DialogDescription>Unlock the full power of TargetPay</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 my-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 p-2 rounded-lg">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleUpgrade} className="w-full gap-2">
            <Sparkles className="h-4 w-4" />
            {isMockMode || import.meta.env.DEV ? '🧪 Activate Test Mode' : 'Start 7-Day Free Trial'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Maybe Later
          </Button>
        </div>

        {(isMockMode || import.meta.env.DEV) && (
          <p className="text-xs text-center text-muted-foreground">
            Test mode — no payment required
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
