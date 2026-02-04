import { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';

interface CategoryBarChartProps {
  selectedMonth: string;
}

export default function CategoryBarChart({ selectedMonth }: CategoryBarChartProps) {
  const { data: expenses = [] } = useExpenses({ month: selectedMonth });
  const { data: categories = [] } = useCategories();

  const chartData = useMemo(() => {
    const categorySpending = expenses.reduce((acc, exp) => {
      if (exp.category_id) {
        acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    return categories
      .map(cat => ({
        name: cat.name,
        spent: categorySpending[cat.id] || 0,
        budget: Number(cat.monthly_budget) || 0,
        color: cat.color,
      }))
      .filter(item => item.spent > 0 || item.budget > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 8);
  }, [expenses, categories]);

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ₹{entry.value.toLocaleString('en-IN')}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card className="chart-container">
        <CardHeader>
          <CardTitle className="text-lg">Budget vs Spending</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No data to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="chart-container">
      <CardHeader>
        <CardTitle className="text-lg">Budget vs Spending</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                type="number" 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="spent" 
                name="Spent" 
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
              <Bar 
                dataKey="budget" 
                name="Budget" 
                fill="hsl(var(--muted))"
                radius={[0, 4, 4, 0]}
                opacity={0.5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
