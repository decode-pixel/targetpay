import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  ArrowRightLeft,
  X,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react';
import { BudgetSuggestion } from '@/types/budget';
import { useSetCategoryBudget } from '@/hooks/useCategoryBudgets';

interface BudgetSuggestionsProps {
  suggestions: BudgetSuggestion[];
  month: string;
  onDismiss?: (id: string) => void;
  className?: string;
}

export default function BudgetSuggestions({ 
  suggestions, 
  month,
  onDismiss,
  className 
}: BudgetSuggestionsProps) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const setBudget = useSetCategoryBudget();

  const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.id));

  if (visibleSuggestions.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    onDismiss?.(id);
  };

  const handleReallocation = async (suggestion: BudgetSuggestion) => {
    if (suggestion.action?.categoryId && suggestion.action?.suggestedAmount) {
      await setBudget.mutateAsync({
        categoryId: suggestion.action.categoryId,
        month,
        budgetAmount: suggestion.action.suggestedAmount,
      });
      handleDismiss(suggestion.id);
    }
  };

  const getIcon = (type: BudgetSuggestion['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'reallocation':
        return <ArrowRightLeft className="h-4 w-4 text-purple-500" />;
    }
  };

  const getBgColor = (type: BudgetSuggestion['type']) => {
    switch (type) {
      case 'warning':
        return 'bg-orange-500/10 border-orange-500/20';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'success':
        return 'bg-green-500/10 border-green-500/20';
      case 'reallocation':
        return 'bg-purple-500/10 border-purple-500/20';
    }
  };

  return (
    <Card className={cn('border-border/50', className)}>
      <CardHeader className="pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Smart Suggestions
            <span className="text-xs font-normal text-muted-foreground">
              ({visibleSuggestions.length})
            </span>
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-2 pt-2">
          {visibleSuggestions.slice(0, 5).map((suggestion) => (
            <div
              key={suggestion.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border',
                getBgColor(suggestion.type)
              )}
            >
              <div className="shrink-0 mt-0.5">
                {getIcon(suggestion.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {suggestion.message}
                </p>
                {suggestion.action && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 text-xs"
                    onClick={() => handleReallocation(suggestion)}
                    disabled={setBudget.isPending}
                  >
                    {suggestion.action.label}
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => handleDismiss(suggestion.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          
          {visibleSuggestions.length > 5 && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              +{visibleSuggestions.length - 5} more suggestions
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
