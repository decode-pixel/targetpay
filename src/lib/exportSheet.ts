import { Expense } from '@/types/expense';
import { format, parse } from 'date-fns';
import { Profile } from '@/hooks/useProfile';

interface CategoryInfo {
  id: string;
  name: string;
  monthly_budget: number | null;
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(row: (string | number | null)[]): string {
  return row.map(escapeCSV).join(',');
}

export function exportMonthlyReport(
  expenses: Expense[],
  categories: CategoryInfo[],
  profile: Profile | null,
  month: string // YYYY-MM
) {
  const monthDate = parse(month + '-01', 'yyyy-MM-dd', new Date());
  const monthLabel = format(monthDate, 'MMMM yyyy');
  const shortMonth = format(monthDate, 'MMM-yyyy');

  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const totalExpense = sorted.reduce((s, e) => s + Number(e.amount), 0);

  const catSpending: Record<string, number> = {};
  sorted.forEach((e) => {
    const catName = e.category?.name || 'Uncategorized';
    catSpending[catName] = (catSpending[catName] || 0) + Number(e.amount);
  });

  const catEntries = Object.entries(catSpending).sort((a, b) => b[1] - a[1]);
  const highestCat = catEntries.length > 0 ? catEntries[0][0] : 'N/A';

  const rows: (string | number | null)[][] = [];

  // Header
  rows.push(['TargetPay']);
  rows.push(['Monthly Expense Statement']);
  rows.push([`Prepared for: ${profile?.full_name || 'User'}`]);
  rows.push([`Period: ${monthLabel}`]);
  rows.push([`Generated: ${format(new Date(), 'dd MMM yyyy')}`]);
  rows.push([]);

  // Summary
  rows.push(['SUMMARY']);
  rows.push(['Total Income', 0]);
  rows.push(['Total Expense', totalExpense]);
  rows.push(['Net Balance', -totalExpense]);
  rows.push(['Total Transactions', sorted.length]);
  rows.push(['Highest Expense Category', highestCat]);
  rows.push([]);

  // Transactions
  rows.push(['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance']);

  let runningBalance = 0;
  sorted.forEach((e) => {
    const amt = Number(e.amount);
    runningBalance += amt;
    const catName = e.category?.name || 'Uncategorized';
    rows.push([
      format(new Date(e.date), 'dd/MM/yyyy'),
      e.note ? `${e.note} (${catName})` : catName,
      catName,
      amt,
      null,
      runningBalance,
    ]);
  });

  rows.push(['', '', 'TOTAL', totalExpense, 0, runningBalance]);
  rows.push([]);
  rows.push([]);

  // Category Summary
  rows.push(['CATEGORY SUMMARY']);
  rows.push(['Category', 'Total Amount', '% of Total']);

  catEntries.forEach(([name, amount]) => {
    const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
    rows.push([name, amount, `${pct.toFixed(1)}%`]);
  });

  // Generate CSV and download
  const csv = rows.map(rowToCSV).join('\n');
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const filename = `TargetPay-${shortMonth}.csv`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}
