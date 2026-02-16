import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface BudgetInsightsProps {
  selectedMonth: string;
}

export default function BudgetInsights({ selectedMonth }: BudgetInsightsProps) {
  const [insights, setInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Record<string, string[]>>({});

  const fetchInsights = async (month: string) => {
    if (cache.current[month]) {
      setInsights(cache.current[month]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('budget-insights', {
        body: { month },
      });

      if (fnError) throw fnError;

      if (data?.success && data.insights) {
        setInsights(data.insights);
        cache.current[month] = data.insights;
      } else {
        setError(data?.error || 'Failed to generate insights');
      }
    } catch (err: any) {
      console.error('Budget insights error:', err);
      setError('Could not generate insights. Try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights(selectedMonth);
  }, [selectedMonth]);

  const handleRetry = () => {
    delete cache.current[selectedMonth];
    fetchInsights(selectedMonth);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="py-3 md:py-4">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Insights
          <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            GPT-4o
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={handleRetry} className="shrink-0">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          </div>
        ) : insights.length > 0 ? (
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-primary font-medium shrink-0">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
