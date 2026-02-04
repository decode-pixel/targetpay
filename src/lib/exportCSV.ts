import { Expense } from '@/types/expense';
import { format } from 'date-fns';

export function exportExpensesToCSV(expenses: Expense[], filename?: string) {
  // CSV headers
  const headers = [
    'Date',
    'Category',
    'Amount',
    'Payment Method',
    'Note',
    'Created At'
  ];

  // Convert expenses to CSV rows
  const rows = expenses.map(expense => [
    format(new Date(expense.date), 'yyyy-MM-dd'),
    expense.category?.name || 'Uncategorized',
    expense.amount.toString(),
    expense.payment_method,
    expense.note ? `"${expense.note.replace(/"/g, '""')}"` : '',
    format(new Date(expense.created_at), 'yyyy-MM-dd HH:mm:ss')
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const defaultFilename = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename || defaultFilename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function exportExpensesSummaryToCSV(
  expenses: Expense[],
  categories: { id: string; name: string; monthly_budget: number | null }[]
) {
  // Calculate category summaries
  const categorySpending = expenses.reduce((acc, exp) => {
    if (exp.category_id) {
      acc[exp.category_id] = (acc[exp.category_id] || 0) + Number(exp.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  const headers = ['Category', 'Amount Spent', 'Monthly Budget', 'Remaining', 'Usage %'];
  
  const rows = categories.map(cat => {
    const spent = categorySpending[cat.id] || 0;
    const budget = Number(cat.monthly_budget) || 0;
    const remaining = budget - spent;
    const percentage = budget > 0 ? ((spent / budget) * 100).toFixed(1) : 'N/A';
    
    return [
      cat.name,
      spent.toString(),
      budget.toString(),
      remaining.toString(),
      percentage
    ];
  });

  // Add totals row
  const totalSpent = Object.values(categorySpending).reduce((a, b) => a + b, 0);
  const totalBudget = categories.reduce((sum, cat) => sum + (Number(cat.monthly_budget) || 0), 0);
  rows.push([
    'TOTAL',
    totalSpent.toString(),
    totalBudget.toString(),
    (totalBudget - totalSpent).toString(),
    totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 'N/A'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `expense-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
