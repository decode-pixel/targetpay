import { useState, useEffect } from 'react';
import { Save, Settings, IndianRupee, Percent, Shield, Zap, ZapOff, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinancialSettings, useUpdateFinancialSettings } from '@/hooks/useFinancialSettings';
import { BudgetMode } from '@/types/budget';
import { cn } from '@/lib/utils';

interface FinancialSettingsCardProps {
  className?: string;
}

const MODE_CONFIG: Record<BudgetMode, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  bullets: string[];
}> = {
  flexible: {
    icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    bullets: [
      'No restrictions on spending',
      'Tips shown at 90% and 100% usage',
      'Free adjustment of budget allocation',
      'Light health score impact (-5 per violation)',
    ],
  },
  guided: {
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    bullets: [
      'Warnings when exceeding category budgets',
      'Alerts at 70%, 90%, and 100% thresholds',
      'Soft warning if allocation deviates from 50/30/20',
      'Medium health score impact (-10 per violation)',
    ],
  },
  strict: {
    icon: <Lock className="h-5 w-5 text-red-500" />,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    bullets: [
      'Override confirmation required for over-budget expenses',
      'Alerts start at 50% usage with strong warnings',
      'Allocation locked to 50/30/20 rule',
      'Heavy health score impact (-15 per violation)',
    ],
  },
};

export default function FinancialSettingsCard({ className }: FinancialSettingsCardProps) {
  const { data: settings, isLoading } = useFinancialSettings();
  const updateSettings = useUpdateFinancialSettings();

  const [income, setIncome] = useState('');
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('flexible');
  const [needsPercent, setNeedsPercent] = useState(50);
  const [wantsPercent, setWantsPercent] = useState(30);
  const [savingsPercent, setSavingsPercent] = useState(20);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [smartRulesEnabled, setSmartRulesEnabled] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setIncome(settings.monthly_income?.toString() || '');
      setBudgetMode(settings.budget_mode);
      setNeedsPercent(settings.needs_percentage);
      setWantsPercent(settings.wants_percentage);
      setSavingsPercent(settings.savings_percentage);
      setShowSuggestions(settings.show_budget_suggestions);
      setSmartRulesEnabled(settings.smart_rules_enabled ?? true);
    }
  }, [settings]);

  const isStrict = budgetMode === 'strict';
  const isGuided = budgetMode === 'guided';

  // Check if allocation deviates from 50/30/20
  const allocationDeviation = Math.abs(needsPercent - 50) + Math.abs(wantsPercent - 30) + Math.abs(savingsPercent - 20);
  const showGuidedWarning = isGuided && allocationDeviation > 20; // >10% deviation on any

  const handleIncomeChange = (value: string) => {
    setIncome(value);
    setHasChanges(true);
  };

  const handleModeChange = async (mode: BudgetMode) => {
    setBudgetMode(mode);
    
    let newNeeds = needsPercent;
    let newWants = wantsPercent;
    let newSavings = savingsPercent;
    
    // In strict mode, lock to 50/30/20
    if (mode === 'strict') {
      newNeeds = 50;
      newWants = 30;
      newSavings = 20;
      setNeedsPercent(50);
      setWantsPercent(30);
      setSavingsPercent(20);
    }
    
    // Auto-save immediately
    await updateSettings.mutateAsync({
      monthly_income: income ? parseFloat(income) : null,
      budget_mode: mode,
      needs_percentage: newNeeds,
      wants_percentage: newWants,
      savings_percentage: newSavings,
      show_budget_suggestions: showSuggestions,
      smart_rules_enabled: smartRulesEnabled,
    });
  };

  const handleSmartRulesToggle = async (enabled: boolean) => {
    setSmartRulesEnabled(enabled);
    await updateSettings.mutateAsync({
      monthly_income: income ? parseFloat(income) : null,
      budget_mode: budgetMode,
      needs_percentage: needsPercent,
      wants_percentage: wantsPercent,
      savings_percentage: savingsPercent,
      show_budget_suggestions: showSuggestions,
      smart_rules_enabled: enabled,
    });
  };

  const handlePercentageChange = (type: 'needs' | 'wants' | 'savings', value: number) => {
    if (isStrict) return; // Locked in strict mode
    
    const remaining = 100 - value;
    
    if (type === 'needs') {
      setNeedsPercent(value);
      const ratio = wantsPercent / (wantsPercent + savingsPercent) || 0.6;
      setWantsPercent(Math.round(remaining * ratio));
      setSavingsPercent(Math.round(remaining * (1 - ratio)));
    } else if (type === 'wants') {
      setWantsPercent(value);
      const ratio = needsPercent / (needsPercent + savingsPercent) || 0.7;
      setNeedsPercent(Math.round(remaining * ratio));
      setSavingsPercent(Math.round(remaining * (1 - ratio)));
    } else {
      setSavingsPercent(value);
      const ratio = needsPercent / (needsPercent + wantsPercent) || 0.6;
      setNeedsPercent(Math.round(remaining * ratio));
      setWantsPercent(Math.round(remaining * (1 - ratio)));
    }
    
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      monthly_income: income ? parseFloat(income) : null,
      budget_mode: budgetMode,
      needs_percentage: needsPercent,
      wants_percentage: wantsPercent,
      savings_percentage: savingsPercent,
      show_budget_suggestions: showSuggestions,
      smart_rules_enabled: smartRulesEnabled,
    });
    setHasChanges(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const incomeValue = parseFloat(income) || 0;
  const modeConfig = MODE_CONFIG[budgetMode];

  if (isLoading) {
    return (
      <Card className={cn('border-border/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-border/50', className)}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Budget Settings
        </CardTitle>
        <CardDescription>
          Configure your income and budget allocation preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Smart Budget Rules Toggle */}
        <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {smartRulesEnabled ? (
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <ZapOff className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <Label htmlFor="smart-rules" className="text-base font-semibold cursor-pointer">
                  Smart Budget Rules
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {smartRulesEnabled 
                    ? 'AI-powered suggestions and rules enabled' 
                    : 'Simple mode - manual budgets only'}
                </p>
              </div>
            </div>
            <Switch
              id="smart-rules"
              checked={smartRulesEnabled}
              onCheckedChange={handleSmartRulesToggle}
            />
          </div>
          
          <div className="mt-3 pt-3 border-t border-primary/20">
            {smartRulesEnabled ? (
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  50/30/20 rule-based budget guidance
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Smart alerts at configurable thresholds
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Budget health score & suggestions
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Category type classification (Needs/Wants/Savings)
                </li>
              </ul>
            ) : (
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Simple category-wise budgets
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Manual budget control only
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  No AI recommendations
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Monthly Income */}
        <div className="space-y-2">
          <Label htmlFor="income" className="flex items-center gap-2">
            <IndianRupee className="h-3.5 w-3.5" />
            Monthly Income (Optional)
          </Label>
          <Input
            id="income"
            type="number"
            placeholder="Enter your monthly income"
            value={income}
            onChange={(e) => handleIncomeChange(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            {smartRulesEnabled 
              ? 'Used for percentage-based budget recommendations'
              : 'Track your income for reference'}
          </p>
        </div>

        {/* Advanced settings */}
        {smartRulesEnabled && (
          <>
            {/* Budget Mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" />
                Rule Enforcement
              </Label>
              <Select 
                value={budgetMode} 
                onValueChange={(v) => handleModeChange(v as BudgetMode)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flexible">
                    <div className="flex flex-col items-start">
                      <span>Flexible</span>
                      <span className="text-xs text-muted-foreground">Suggestions only, no restrictions</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="guided">
                    <div className="flex flex-col items-start">
                      <span>Guided</span>
                      <span className="text-xs text-muted-foreground">Warnings when rules are violated</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="strict">
                    <div className="flex flex-col items-start">
                      <span>Strict</span>
                      <span className="text-xs text-muted-foreground">Requires override for violations</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Live Preview Card */}
            <div className={cn(
              'rounded-xl border-2 p-4 space-y-3 transition-all duration-300',
              modeConfig.borderColor,
              modeConfig.bgColor,
            )}>
              <div className="flex items-center gap-2">
                {modeConfig.icon}
                <span className={cn('font-semibold capitalize', modeConfig.color)}>
                  {budgetMode} Mode
                </span>
                <Badge variant="outline" className={cn('ml-auto text-xs', modeConfig.color)}>
                  Active
                </Badge>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {modeConfig.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={cn(
                      'h-1.5 w-1.5 rounded-full mt-1 shrink-0',
                      budgetMode === 'flexible' ? 'bg-green-500' :
                      budgetMode === 'guided' ? 'bg-yellow-500' : 'bg-red-500'
                    )} />
                    {bullet}
                  </li>
                ))}
              </ul>
              
              {/* Animated allocation bar */}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1.5">Allocation Split</p>
                <div className="h-3 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-blue-500 transition-all duration-500 ease-out" 
                    style={{ width: `${needsPercent}%` }}
                    title={`Needs: ${needsPercent}%`}
                  />
                  <div 
                    className="bg-amber-500 transition-all duration-500 ease-out" 
                    style={{ width: `${wantsPercent}%` }}
                    title={`Wants: ${wantsPercent}%`}
                  />
                  <div 
                    className="bg-emerald-500 transition-all duration-500 ease-out" 
                    style={{ width: `${savingsPercent}%` }}
                    title={`Savings: ${savingsPercent}%`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Needs {needsPercent}%</span>
                  <span>Wants {wantsPercent}%</span>
                  <span>Savings {savingsPercent}%</span>
                </div>
              </div>
            </div>

            {/* Budget Allocation */}
            {incomeValue > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-3.5 w-3.5" />
                    Budget Allocation (50/30/20 Rule)
                  </Label>
                  {isStrict && (
                    <Badge variant="outline" className="text-xs text-red-500 border-red-500/30 gap-1">
                      <Lock className="h-3 w-3" />
                      Locked
                    </Badge>
                  )}
                </div>

                {showGuidedWarning && (
                  <Alert className="border-yellow-500/50 bg-yellow-500/10">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-xs">
                      Your allocation deviates significantly from the recommended 50/30/20 rule.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Needs</span>
                      <span className="font-medium">
                        {needsPercent}% ({formatCurrency(incomeValue * needsPercent / 100)})
                      </span>
                    </div>
                    <Slider
                      value={[needsPercent]}
                      onValueChange={([v]) => handlePercentageChange('needs', v)}
                      max={80}
                      min={20}
                      step={5}
                      className="py-2"
                      disabled={isStrict}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Wants</span>
                      <span className="font-medium">
                        {wantsPercent}% ({formatCurrency(incomeValue * wantsPercent / 100)})
                      </span>
                    </div>
                    <Slider
                      value={[wantsPercent]}
                      onValueChange={([v]) => handlePercentageChange('wants', v)}
                      max={60}
                      min={10}
                      step={5}
                      className="py-2"
                      disabled={isStrict}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Savings</span>
                      <span className="font-medium">
                        {savingsPercent}% ({formatCurrency(incomeValue * savingsPercent / 100)})
                      </span>
                    </div>
                    <Slider
                      value={[savingsPercent]}
                      onValueChange={([v]) => handlePercentageChange('savings', v)}
                      max={50}
                      min={5}
                      step={5}
                      className="py-2"
                      disabled={isStrict}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Show Suggestions Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label htmlFor="suggestions">Smart Suggestions</Label>
                <p className="text-xs text-muted-foreground">
                  Show budget tips and alerts
                </p>
              </div>
              <Switch
                id="suggestions"
                checked={showSuggestions}
                onCheckedChange={async (v) => {
                  setShowSuggestions(v);
                  await updateSettings.mutateAsync({
                    monthly_income: income ? parseFloat(income) : null,
                    budget_mode: budgetMode,
                    needs_percentage: needsPercent,
                    wants_percentage: wantsPercent,
                    savings_percentage: savingsPercent,
                    show_budget_suggestions: v,
                    smart_rules_enabled: smartRulesEnabled,
                  });
                }}
              />
            </div>
          </>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateSettings.isPending}
          className="w-full h-11"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
