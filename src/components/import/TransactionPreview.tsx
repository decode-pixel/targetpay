import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  Check, 
  Edit2, 
  Trash2, 
  ChevronDown,
  AlertCircle,
  Copy,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { ExtractedTransaction } from '@/types/import';
import { Category } from '@/types/expense';
import { useIsMobile } from '@/hooks/use-mobile';

interface TransactionPreviewProps {
  transactions: ExtractedTransaction[];
  categories: Category[];
  onTransactionUpdate: (id: string, updates: Partial<ExtractedTransaction>) => void;
  onSelectionChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  showCategories?: boolean;
}

export default function TransactionPreview({
  transactions,
  categories,
  onTransactionUpdate,
  onSelectionChange,
  onSelectAll,
  showCategories = false,
}: TransactionPreviewProps) {
  const isMobile = useIsMobile();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    description?: string;
    amount?: string;
    transaction_date?: string;
  }>({});

  const selectedCount = transactions.filter(t => t.is_selected).length;
  const duplicateCount = transactions.filter(t => t.is_duplicate).length;
  const totalAmount = transactions
    .filter(t => t.is_selected)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    const pct = Math.round(confidence * 100);
    if (pct >= 80) {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">{pct}%</Badge>;
    } else if (pct >= 50) {
      return <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border text-xs">{pct}%</Badge>;
    } else {
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">{pct}%</Badge>;
    }
  };

  const startEdit = (tx: ExtractedTransaction) => {
    setEditingId(tx.id);
    setEditValues({
      description: tx.description,
      amount: tx.amount.toString(),
      transaction_date: tx.transaction_date,
    });
  };

  const saveEdit = (id: string) => {
    onTransactionUpdate(id, {
      description: editValues.description,
      amount: parseFloat(editValues.amount || '0'),
      transaction_date: editValues.transaction_date,
    });
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Summary bar */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedCount === transactions.length && transactions.length > 0}
              onCheckedChange={(checked) => onSelectAll(!!checked)}
            />
            <span className="text-sm">
              {selectedCount}/{transactions.length}
            </span>
            {duplicateCount > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Copy className="h-3 w-3" />
                {duplicateCount}
              </Badge>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Selected total</p>
            <p className="font-semibold text-destructive text-sm">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Transaction cards */}
        <div className="space-y-2">
          {transactions.map((tx) => (
            <Collapsible
              key={tx.id}
              open={expandedId === tx.id}
              onOpenChange={(open) => setExpandedId(open ? tx.id : null)}
            >
              <div
                className={cn(
                  'border rounded-lg overflow-hidden transition-all duration-200',
                  !tx.is_selected && 'opacity-60',
                  tx.is_duplicate && 'border-warning/50 bg-warning/5'
                )}
              >
                {/* Card header - always visible */}
                <div className="flex items-center gap-3 p-3">
                  <Checkbox
                    checked={tx.is_selected}
                    onCheckedChange={(checked) => onSelectionChange(tx.id, !!checked)}
                    className="shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{tx.description}</p>
                      <p className="font-semibold text-destructive text-sm tabular-nums shrink-0">
                        -{formatCurrency(tx.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(tx.transaction_date), 'dd MMM')}
                      </span>
                      {tx.is_duplicate && (
                        <span className="flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          Duplicate
                        </span>
                      )}
                      {showCategories && tx.suggested_category && (
                        <span 
                          className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: tx.suggested_category.color + '20' }}
                        >
                          <DynamicIcon 
                            name={tx.suggested_category.icon} 
                            className="h-3 w-3"
                            style={{ color: tx.suggested_category.color }}
                          />
                          <span style={{ color: tx.suggested_category.color }}>
                            {tx.suggested_category.name}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      {expandedId === tx.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                {/* Expanded content */}
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-0 space-y-3 border-t">
                    {editingId === tx.id ? (
                      <div className="space-y-3 pt-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Description</label>
                          <Input
                            value={editValues.description}
                            onChange={(e) => setEditValues(v => ({ ...v, description: e.target.value }))}
                            className="h-10 mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Date</label>
                            <Input
                              type="date"
                              value={editValues.transaction_date}
                              onChange={(e) => setEditValues(v => ({ ...v, transaction_date: e.target.value }))}
                              className="h-10 mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Amount</label>
                            <Input
                              type="number"
                              value={editValues.amount}
                              onChange={(e) => setEditValues(v => ({ ...v, amount: e.target.value }))}
                              className="h-10 mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => saveEdit(tx.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-3">
                        {showCategories && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                            <div className="flex items-center gap-2">
                              <Select
                                value={tx.suggested_category_id || ''}
                                onValueChange={(value) => onTransactionUpdate(tx.id, { 
                                  suggested_category_id: value || null 
                                })}
                              >
                                <SelectTrigger className="h-10 flex-1">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      <div className="flex items-center gap-2">
                                        <DynamicIcon 
                                          name={cat.icon} 
                                          className="h-4 w-4"
                                          style={{ color: cat.color }}
                                        />
                                        {cat.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {tx.ai_confidence !== null && getConfidenceBadge(tx.ai_confidence)}
                            </div>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => startEdit(tx)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Transaction
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        {transactions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No transactions found</p>
          </div>
        )}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedCount === transactions.length && transactions.length > 0}
              onCheckedChange={(checked) => onSelectAll(!!checked)}
            />
            <span className="text-sm">
              {selectedCount} of {transactions.length} selected
            </span>
          </div>
          {duplicateCount > 0 && (
            <Badge variant="outline" className="gap-1 text-accent-foreground">
              <Copy className="h-3 w-3" />
              {duplicateCount} potential duplicates
            </Badge>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Selected total</p>
          <p className="font-semibold text-destructive">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Transaction table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="w-12 p-3"></th>
              <th className="w-28 p-3 text-left text-sm font-medium">Date</th>
              <th className="p-3 text-left text-sm font-medium">Description</th>
              {showCategories && <th className="w-40 p-3 text-left text-sm font-medium">Category</th>}
              <th className="w-32 p-3 text-right text-sm font-medium">Amount</th>
              <th className="w-20 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr 
                key={tx.id}
                className={cn(
                  'border-b last:border-0',
                  !tx.is_selected && 'opacity-50',
                  tx.is_duplicate && 'bg-warning/5'
                )}
              >
                <td className="p-3">
                  <Checkbox
                    checked={tx.is_selected}
                    onCheckedChange={(checked) => onSelectionChange(tx.id, !!checked)}
                  />
                </td>
                <td className="p-3">
                  {editingId === tx.id ? (
                    <Input
                      type="date"
                      value={editValues.transaction_date}
                      onChange={(e) => setEditValues(v => ({ ...v, transaction_date: e.target.value }))}
                      className="h-8 w-28"
                    />
                  ) : (
                    <span className="text-sm">
                      {format(new Date(tx.transaction_date), 'dd MMM yyyy')}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-start gap-2">
                    {editingId === tx.id ? (
                      <Input
                        value={editValues.description}
                        onChange={(e) => setEditValues(v => ({ ...v, description: e.target.value }))}
                        className="h-8"
                      />
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-medium line-clamp-1">{tx.description}</p>
                        {tx.is_duplicate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <AlertTriangle className="h-3 w-3" />
                            Possible duplicate
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                {showCategories && (
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={tx.suggested_category_id || ''}
                        onValueChange={(value) => onTransactionUpdate(tx.id, { 
                          suggested_category_id: value || null 
                        })}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Select category">
                            {tx.suggested_category && (
                              <div className="flex items-center gap-2">
                                <DynamicIcon 
                                  name={tx.suggested_category.icon} 
                                  className="h-3 w-3"
                                  style={{ color: tx.suggested_category.color }}
                                />
                                <span className="text-sm truncate">
                                  {tx.suggested_category.name}
                                </span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <DynamicIcon 
                                  name={cat.icon} 
                                  className="h-4 w-4"
                                  style={{ color: cat.color }}
                                />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {tx.ai_confidence !== null && getConfidenceBadge(tx.ai_confidence)}
                    </div>
                  </td>
                )}
                <td className="p-3 text-right">
                  {editingId === tx.id ? (
                    <Input
                      type="number"
                      value={editValues.amount}
                      onChange={(e) => setEditValues(v => ({ ...v, amount: e.target.value }))}
                      className="h-8 w-24 text-right"
                    />
                  ) : (
                    <span className="font-medium text-destructive tabular-nums">
                      -{formatCurrency(tx.amount)}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {editingId === tx.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => saveEdit(tx.id)}
                      >
                        <Check className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={cancelEdit}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => startEdit(tx)}
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No transactions found</p>
        </div>
      )}
    </div>
  );
}
