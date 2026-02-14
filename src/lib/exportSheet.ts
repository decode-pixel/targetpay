import * as XLSX from 'xlsx';
import { Expense } from '@/types/expense';
import { format, parse } from 'date-fns';
import { Profile } from '@/hooks/useProfile';

interface CategoryInfo {
  id: string;
  name: string;
  monthly_budget: number | null;
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

  // Sort expenses by date ascending
  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const totalExpense = sorted.reduce((s, e) => s + Number(e.amount), 0);

  // Category spending map
  const catSpending: Record<string, number> = {};
  sorted.forEach((e) => {
    const catName = e.category?.name || 'Uncategorized';
    catSpending[catName] = (catSpending[catName] || 0) + Number(e.amount);
  });

  const catEntries = Object.entries(catSpending).sort((a, b) => b[1] - a[1]);
  const highestCat = catEntries.length > 0 ? catEntries[0][0] : 'N/A';

  // Build rows
  const rows: (string | number | null)[][] = [];

  // --- Header Section ---
  rows.push(['TargetPay']);
  rows.push(['Monthly Expense Statement']);
  rows.push([`Prepared for: ${profile?.full_name || 'User'}`]);
  rows.push([`Period: ${monthLabel}`]);
  rows.push([`Generated: ${format(new Date(), 'dd MMM yyyy')}`]);
  rows.push([]); // spacer

  // --- Summary Section ---
  rows.push(['SUMMARY']);
  rows.push(['Total Income', 0]);
  rows.push(['Total Expense', totalExpense]);
  rows.push(['Net Balance', -totalExpense]);
  rows.push(['Total Transactions', sorted.length]);
  rows.push(['Highest Expense Category', highestCat]);
  rows.push([]); // spacer

  // --- Transaction Table ---
  const tableHeaderRow = rows.length;
  rows.push(['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance']);

  let runningBalance = 0;
  sorted.forEach((e) => {
    const amt = Number(e.amount);
    runningBalance += amt;
    rows.push([
      format(new Date(e.date), 'dd/MM/yyyy'),
      e.note || '-',
      e.category?.name || 'Uncategorized',
      amt,
      null,
      runningBalance,
    ]);
  });

  // Totals row
  const totalsRowIdx = rows.length;
  rows.push(['', '', 'TOTAL', totalExpense, 0, runningBalance]);
  rows.push([]); // spacer
  rows.push([]); // spacer

  // --- Category Summary ---
  const catHeaderRow = rows.length;
  rows.push(['CATEGORY SUMMARY']);
  rows.push(['Category', 'Total Amount', '% of Total']);

  catEntries.forEach(([name, amount]) => {
    const pct = totalExpense > 0 ? ((amount / totalExpense) * 100) : 0;
    rows.push([name, amount, `${pct.toFixed(1)}%`]);
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, // Date / labels
    { wch: 30 }, // Description
    { wch: 18 }, // Category
    { wch: 14 }, // Debit
    { wch: 14 }, // Credit
    { wch: 14 }, // Balance
  ];

  // Freeze panes: freeze at the transaction header row
  ws['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow + 1 };

  // Bold styling for key cells (SheetJS community edition has limited style support,
  // but we can set cell types for number formatting)
  // Set currency format for Debit/Credit/Balance columns in transaction rows
  const dataStartRow = tableHeaderRow + 1;
  const dataEndRow = totalsRowIdx;
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    ['D', 'E', 'F'].forEach((col) => {
      const cell = ws[`${col}${r + 1}`];
      if (cell && typeof cell.v === 'number') {
        cell.z = '₹#,##0.00';
      }
    });
  }

  // Format summary amounts
  [8, 9, 10].forEach((r) => {
    const cell = ws[`B${r + 1}`];
    if (cell && typeof cell.v === 'number') {
      cell.z = '₹#,##0.00';
    }
  });

  // Create workbook and export
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expense Report');

  const filename = `TargetPay-${shortMonth}.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
}
