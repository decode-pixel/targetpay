import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BudgetHealthMetrics } from '@/types/budget';

interface BudgetHealthScoreProps {
  metrics: BudgetHealthMetrics;
  className?: string;
}

export default function BudgetHealthScore({ metrics, className }: BudgetHealthScoreProps) {
  const { score, needsUsage, wantsUsage, overBudgetCategories } = metrics;
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="h-5 w-5" />;
    if (score >= 60) return <TrendingUp className="h-5 w-5" />;
    if (score >= 40) return <TrendingDown className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  const getProgressColor = (usage: number) => {
    if (usage > 100) return '[&>div]:bg-destructive';
    if (usage > 80) return '[&>div]:bg-orange-500';
    return '';
  };

  return (
    <Card className={cn('border-border/50', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          Budget Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-14 w-14 rounded-full flex items-center justify-center text-2xl font-bold',
              'bg-gradient-to-br from-primary/20 to-primary/5',
              getScoreColor(score)
            )}>
              {score}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('font-semibold', getScoreColor(score))}>
                  {getScoreLabel(score)}
                </span>
                {getScoreIcon(score)}
              </div>
              <p className="text-xs text-muted-foreground">
                Your budget health score
              </p>
            </div>
          </div>
          
          {overBudgetCategories > 0 && (
            <Badge variant="destructive" className="shrink-0">
              {overBudgetCategories} over budget
            </Badge>
          )}
        </div>

        {/* Category Type Progress */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Needs</span>
              <span className={cn(
                'font-medium tabular-nums',
                needsUsage > 100 && 'text-destructive'
              )}>
                {needsUsage}%
              </span>
            </div>
            <Progress 
              value={Math.min(needsUsage, 100)} 
              className={cn('h-2', getProgressColor(needsUsage))}
            />
          </div>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wants</span>
              <span className={cn(
                'font-medium tabular-nums',
                wantsUsage > 100 && 'text-destructive'
              )}>
                {wantsUsage}%
              </span>
            </div>
            <Progress 
              value={Math.min(wantsUsage, 100)} 
              className={cn('h-2', getProgressColor(wantsUsage))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
