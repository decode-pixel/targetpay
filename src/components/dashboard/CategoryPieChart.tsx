import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useExpenses } from '@/hooks/useExpenses';
import { useCategories } from '@/hooks/useCategories';

interface CategoryPieChartProps {
  selectedMonth: string;
  onCategoryClick?: (categoryId: string) => void;
}

export default function CategoryPieChart({ selectedMonth, onCategoryClick }: CategoryPieChartProps) {
  const { data: expenses = [] } = useExpenses({ month: selectedMonth });
  const { data: categories = [] } = useCategories();

  const chartData = useMemo(() => {
    const categorySpending = expenses.reduce((acc, exp) => {
      if (exp.category_id) {
        acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    const total = Object.values(categorySpending).reduce((sum, val) => sum + val, 0);

    return Object.entries(categorySpending)
      .map(([catId, amount]) => {
        const category = categories.find(c => c.id === catId);
        return {
          id: catId,
          name: category?.name || 'Unknown',
          value: amount,
          color: category?.color || '#6B7280',
          percentage: total > 0 ? ((amount / total) * 100).toFixed(1) : '0',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.value)} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const handleClick = (data: any) => {
    if (onCategoryClick && data.id) {
      onCategoryClick(data.id);
    }
  };

  if (chartData.length === 0) {
    return (
      <Card className="chart-container">
        <CardHeader>
          <CardTitle className="text-lg">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground">No expenses to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="chart-container">
      <CardHeader>
        <CardTitle className="text-lg">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onClick={handleClick}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                formatter={(value: string) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
