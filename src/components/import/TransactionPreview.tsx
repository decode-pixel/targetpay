import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  Check, 
  Edit2, 
  Trash2, 
  ChevronDown,
  AlertCircle,
  Copy
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import DynamicIcon from '@/components/ui/DynamicIcon';
import { ExtractedTransaction } from '@/types/import';
import { Category } from '@/types/expense';

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
  const [editingId, setEditingId] = useState<string | null>(null);
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
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{pct}%</Badge>;
    } else if (pct >= 50) {
      return <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border">{pct}%</Badge>;
    } else {
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">{pct}%</Badge>;
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

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedCount === transactions.length}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              {showCategories && <TableHead className="w-40">Category</TableHead>}
              <TableHead className="w-32 text-right">Amount</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow 
                key={tx.id}
                className={cn(
                  !tx.is_selected && 'opacity-50',
                  tx.is_duplicate && 'bg-accent/50'
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={tx.is_selected}
                    onCheckedChange={(checked) => onSelectionChange(tx.id, !!checked)}
                  />
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
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
                </TableCell>
                {showCategories && (
                  <TableCell>
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
                      {showCategories && tx.ai_confidence !== null && (
                        <Tooltip>
                          <TooltipTrigger>
                            {getConfidenceBadge(tx.ai_confidence)}
                          </TooltipTrigger>
                          <TooltipContent>
                            AI confidence score
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right">
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
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
