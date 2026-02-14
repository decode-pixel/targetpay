

# Google Sheets Professional Export

Replace the current CSV export with a single, structured Google Sheets-compatible export that produces a professional monthly expense statement. No PDF logic involved.

## Approach

Since we can't use Google Sheets API directly from the browser (would require OAuth), we'll generate an **Excel (.xlsx) file** using the `xlsx` (SheetJS) library. Excel files open natively in Google Sheets with full formatting preserved (bold, column widths, number formats, frozen rows, alignment). This is the standard approach for "Google Sheets export" in web apps.

## What Changes

### 1. Install `xlsx` dependency
Add the SheetJS library (`xlsx`) for generating formatted spreadsheets client-side.

### 2. Replace `src/lib/exportCSV.ts` with `src/lib/exportSheet.ts`
New file with a single export function: `exportMonthlyReport(expenses, categories, profile, month)`.

The generated sheet will contain these sections in order:

**Header Section (rows 1-6)**
- Row 1: "TargetPay" (app name, bold, large)
- Row 2: "Monthly Expense Statement"
- Row 3: User name (from profile)
- Row 4: Month & Year (e.g., "February 2026")
- Row 5: "Generated: 14 Feb 2026"
- Row 6: blank spacer

**Summary Section (rows 7-13)**
- Row 7: "SUMMARY" header (bold)
- Rows 8-12: Total Income (N/A -- app tracks expenses only, so show 0), Total Expense, Net Balance, Total Transactions, Highest Expense Category
- Row 13: blank spacer

**Transaction Table (rows 14+)**
- Header row: Date | Description | Category | Debit | Credit | Balance (bold, frozen)
- Sorted by date ascending
- Date formatted as DD/MM/YYYY
- Amount columns in INR currency format, right-aligned
- Running balance column
- Final totals row (bold)

**Category Summary Section (after transactions + 2 blank rows)**
- Header: "CATEGORY SUMMARY" (bold)
- Columns: Category | Total Amount | % of Total
- Sorted by highest spending first

### 3. Update `src/pages/Expenses.tsx`
- Replace the Export dropdown with a single "Export to Sheet" button
- Add `isExporting` state to disable button during generation
- Show "Generating report..." toast while processing
- Show success toast on completion
- Show error toast if no data: "No transactions for selected month"
- Pass `profile` data (from `useProfile`) and current `filters.month` to the export function

## Files to Create
- `src/lib/exportSheet.ts`

## Files to Modify
- `src/pages/Expenses.tsx` -- replace export dropdown with single Sheet export button
- `package.json` -- add `xlsx` dependency

## Files to Delete
- `src/lib/exportCSV.ts` -- replaced entirely

## Technical Details

The `xlsx` library generates `.xlsx` files entirely client-side. No server calls needed. Google Sheets opens `.xlsx` files with formatting intact (bold, column widths, frozen rows, number formats). The file downloads as `TargetPay-Feb-2026.xlsx`.

Since the app only tracks expenses (no income table), "Total Income" will show as 0 and "Credit" column will be empty. The "Balance" column will show a running total of cumulative spending. If we later add income tracking, these columns are ready.

