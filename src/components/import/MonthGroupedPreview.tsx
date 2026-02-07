import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { ExtractedTransaction } from '@/types/import';

interface MonthGroup {
  month: string; // YYYY-MM
  monthLabel: string; // e.g., "January 2025"
  transactions: ExtractedTransaction[];
  totalAmount: number;
  selectedCount: number;
  hasDateIssues: boolean;
}

interface MonthGroupedPreviewProps {
  transactions: ExtractedTransaction[];
  onConfirm: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export default function MonthGroupedPreview({
  transactions,
  onConfirm,
  onCancel,
  isImporting,
}: MonthGroupedPreviewProps) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Group transactions by their transaction_date month
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const groups = new Map<string, ExtractedTransaction[]>();
    const invalidDateTransactions: ExtractedTransaction[] = [];

    transactions.forEach(tx => {
      try {
        if (!tx.transaction_date) {
          invalidDateTransactions.push(tx);
          return;
        }
        
        const date = parseISO(tx.transaction_date);
        const monthKey = format(date, 'yyyy-MM');
        
        if (!groups.has(monthKey)) {
          groups.set(monthKey, []);
        }
        groups.get(monthKey)!.push(tx);
      } catch {
        invalidDateTransactions.push(tx);
      }
    });

    // Add invalid date transactions to a special group if any
    if (invalidDateTransactions.length > 0) {
      groups.set('invalid', invalidDateTransactions);
    }

    // Convert to array and sort by month (newest first)
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, txs]) => ({
        month: monthKey,
        monthLabel: monthKey === 'invalid' 
          ? 'Date Required' 
          : format(parseISO(`${monthKey}-01`), 'MMMM yyyy'),
        transactions: txs,
        totalAmount: txs.reduce((sum, tx) => sum + Number(tx.amount), 0),
        selectedCount: txs.filter(tx => tx.is_selected).length,
        hasDateIssues: monthKey === 'invalid',
      }));
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalSelected = transactions.filter(tx => tx.is_selected).length;
  const totalAmount = transactions
    .filter(tx => tx.is_selected)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const hasInvalidDates = monthGroups.some(g => g.hasDateIssues);

  return (
    <div className="space-y-4">
      {/* Header with summary */}
      <Alert className="bg-primary/5 border-primary/20">
        <Calendar className="h-4 w-4" />
        <AlertTitle>Month-wise Import Preview</AlertTitle>
        <AlertDescription>
          Transactions are grouped by their actual transaction dates. Each will be 
          recorded in its correct month for accurate budget tracking.
        </AlertDescription>
      </Alert>

      {/* Warning for invalid dates */}
      {hasInvalidDates && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some transactions have invalid dates</AlertTitle>
          <AlertDescription>
            These transactions cannot be imported until their dates are corrected.
          </AlertDescription>
        </Alert>
      )}

      {/* Month groups */}
      <div className="space-y-3">
        {monthGroups.map((group) => (
          <Collapsible
            key={group.month}
            open={expandedMonth === group.month}
            onOpenChange={(open) => setExpandedMonth(open ? group.month : null)}
          >
            <div
              className={cn(
                'border rounded-lg overflow-hidden transition-all',
                group.hasDateIssues && 'border-destructive/50 bg-destructive/5'
              )}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center',
                      group.hasDateIssues 
                        ? 'bg-destructive/10' 
                        : 'bg-primary/10'
                    )}>
                      {group.hasDateIssues ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Calendar className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">{group.monthLabel}</h3>
                      <p className="text-sm text-muted-foreground">
                        {group.selectedCount} of {group.transactions.length} transactions selected
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-destructive tabular-nums">
                        {formatCurrency(group.totalAmount)}
                      </p>
                    </div>
                    {expandedMonth === group.month ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t bg-muted/30 divide-y">
                  {group.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={cn(
                        'p-3 flex items-center gap-3',
                        !tx.is_selected && 'opacity-50'
                      )}
                    >
                      <Checkbox checked={tx.is_selected} disabled className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.transaction_date 
                            ? format(parseISO(tx.transaction_date), 'dd MMM yyyy')
                            : 'No date'
                          }
                        </p>
                      </div>
                      <p className="text-sm font-medium text-destructive tabular-nums shrink-0">
                        -{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Confirmation summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Transactions</span>
          <span className="font-medium">{totalSelected}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Amount</span>
          <span className="font-semibold text-destructive">{formatCurrency(totalAmount)}</span>
        </div>
        {monthGroups.filter(g => !g.hasDateIssues).length > 1 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>
              Expenses will be recorded in {monthGroups.filter(g => !g.hasDateIssues).length} different months
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={isImporting}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={onConfirm}
          disabled={isImporting || hasInvalidDates || totalSelected === 0}
        >
          {isImporting ? (
            <>Importing...</>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Import to {monthGroups.filter(g => !g.hasDateIssues).length} Month(s)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
