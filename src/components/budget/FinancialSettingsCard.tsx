import { useState, useEffect } from 'react';
import { Save, Settings, IndianRupee, Percent, Shield, Zap, ZapOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

  const handleIncomeChange = (value: string) => {
    setIncome(value);
    setHasChanges(true);
  };

  const handleSmartRulesToggle = async (enabled: boolean) => {
    setSmartRulesEnabled(enabled);
    // Auto-save immediately for instant feedback
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
    // Ensure total adds up to 100
    const remaining = 100 - value;
    
    if (type === 'needs') {
      setNeedsPercent(value);
      // Distribute remaining between wants and savings proportionally
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
        {/* Smart Budget Rules Toggle - MAIN TOGGLE */}
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
          
          {/* Mode explanation */}
          <div className="mt-3 pt-3 border-t border-primary/20">
            {smartRulesEnabled ? (
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  50/30/20 rule-based budget guidance
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Smart alerts at 70%, 90%, 100% usage
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

        {/* Monthly Income - Show always */}
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

        {/* Advanced settings - only show when smart rules enabled */}
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
                onValueChange={(v) => { setBudgetMode(v as BudgetMode); setHasChanges(true); }}
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

            {/* Budget Allocation */}
            {incomeValue > 0 && (
              <div className="space-y-4 pt-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5" />
                  Budget Allocation (50/30/20 Rule)
                </Label>
                
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
                onCheckedChange={(v) => { setShowSuggestions(v); setHasChanges(true); }}
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
