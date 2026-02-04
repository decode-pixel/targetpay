import { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export default function MonthlyTrendChart() {
  const { user } = useAuth();

  const { data: monthlyData = [] } = useQuery({
    queryKey: ['monthly-trend'],
    queryFn: async () => {
      if (!user) return [];
      
      // Get last 6 months of data
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        months.push({
          start: format(startOfMonth(date), 'yyyy-MM-dd'),
          end: format(endOfMonth(date), 'yyyy-MM-dd'),
          label: format(date, 'MMM'),
          fullLabel: format(date, 'MMMM yyyy'),
        });
      }

      const results = await Promise.all(
        months.map(async (month) => {
          const { data } = await supabase
            .from('expenses')
            .select('amount')
            .eq('user_id', user.id)
            .gte('date', month.start)
            .lte('date', month.end);
          
          const total = (data || []).reduce((sum, exp) => sum + Number(exp.amount), 0);
          return {
            month: month.label,
            fullMonth: month.fullLabel,
            amount: total,
          };
        })
      );

      return results;
    },
    enabled: !!user,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.fullMonth}</p>
          <p className="text-sm text-primary">
            ₹{data.amount.toLocaleString('en-IN')}
          </p>
        </div>
      );
    }
    return null;
  };

  const hasData = monthlyData.some(d => d.amount > 0);

  return (
    <Card className="chart-container">
      <CardHeader>
        <CardTitle className="text-lg">Monthly Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No trend data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
