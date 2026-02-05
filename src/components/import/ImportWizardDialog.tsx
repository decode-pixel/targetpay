import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import StatementUploader from './StatementUploader';
import TransactionPreview from './TransactionPreview';
import { ImportWizardStep, ExtractedTransaction } from '@/types/import';
import { useCategories } from '@/hooks/useCategories';
import {
  useUploadStatement,
  useParseStatement,
  useCategorizeTransactions,
  useImportTransactions,
  useStatementImport,
  useExtractedTransactions,
  useUpdateExtractedTransaction,
  useDeleteImport,
} from '@/hooks/useStatementImport';
import { cn } from '@/lib/utils';

interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS: { key: ImportWizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'upload', label: 'Upload', icon: <Upload className="h-4 w-4" /> },
  { key: 'processing', label: 'Extract', icon: <Loader2 className="h-4 w-4" /> },
  { key: 'preview', label: 'Preview', icon: <FileText className="h-4 w-4" /> },
  { key: 'categorize', label: 'Categorize', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'confirm', label: 'Import', icon: <CheckCircle2 className="h-4 w-4" /> },
];

export default function ImportWizardDialog({ open, onOpenChange }: ImportWizardDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<ImportWizardStep>('upload');
  const [importId, setImportId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localTransactions, setLocalTransactions] = useState<ExtractedTransaction[]>([]);

  const { data: categories = [] } = useCategories();
  const { data: importRecord, refetch: refetchImport } = useStatementImport(importId);
  const { data: extractedTransactions = [], refetch: refetchTransactions } = useExtractedTransactions(importId);
  
  const uploadMutation = useUploadStatement();
  const parseMutation = useParseStatement();
  const categorizeMutation = useCategorizeTransactions();
  const importMutation = useImportTransactions();
  const updateTransaction = useUpdateExtractedTransaction();
  const deleteImport = useDeleteImport();

  // Sync local transactions with fetched data
  useEffect(() => {
    if (extractedTransactions.length > 0) {
      setLocalTransactions(extractedTransactions);
    }
  }, [extractedTransactions]);

  // Watch import status and advance steps
  useEffect(() => {
    if (!importRecord) return;

    switch (importRecord.status) {
      case 'pending':
      case 'processing':
        setStep('processing');
        break;
      case 'extracted':
        setStep('preview');
        refetchTransactions();
        break;
      case 'categorizing':
        setStep('categorize');
        break;
      case 'ready':
        setStep('confirm');
        refetchTransactions();
        break;
      case 'failed':
        // Stay on current step and show error
        break;
    }
  }, [importRecord?.status, refetchTransactions]);

  const handleUpload = async (file: File) => {
    setUploadProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadMutation.mutateAsync(file);
      setImportId(result.id);
      setUploadProgress(100);
      
      // Start parsing
      setStep('processing');
      await parseMutation.mutateAsync(result.id);
    } catch (error) {
      // Error handled by mutation
    } finally {
      clearInterval(progressInterval);
    }
  };

  const handleCategorize = async () => {
    if (!importId) return;
    setStep('categorize');
    await categorizeMutation.mutateAsync(importId);
  };

  const handleImport = async () => {
    if (!importId) return;

    // Prepare transaction updates (category changes)
    const transactionUpdates = localTransactions
      .filter(t => t.is_selected)
      .map(t => ({
        id: t.id,
        category_id: t.suggested_category_id,
      }));

    await importMutation.mutateAsync({ 
      importId, 
      transactions: transactionUpdates 
    });

    onOpenChange(false);
    navigate('/expenses');
  };

  const handleCancel = async () => {
    if (importId) {
      await deleteImport.mutateAsync(importId);
    }
    resetWizard();
    onOpenChange(false);
  };

  const resetWizard = () => {
    setStep('upload');
    setImportId(null);
    setUploadProgress(0);
    setLocalTransactions([]);
  };

  const handleTransactionUpdate = useCallback((id: string, updates: Partial<ExtractedTransaction>) => {
    setLocalTransactions(prev => 
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
    // Also persist to database
    updateTransaction.mutate({ id, ...updates } as any);
  }, [updateTransaction]);

  const handleSelectionChange = useCallback((id: string, selected: boolean) => {
    setLocalTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, is_selected: selected } : t)
    );
    updateTransaction.mutate({ id, is_selected: selected } as any);
  }, [updateTransaction]);

  const handleSelectAll = useCallback((selected: boolean) => {
    setLocalTransactions(prev =>
      prev.map(t => ({ ...t, is_selected: selected }))
    );
    // Batch update - in production you'd want a dedicated endpoint
    localTransactions.forEach(t => {
      updateTransaction.mutate({ id: t.id, is_selected: selected } as any);
    });
  }, [localTransactions, updateTransaction]);

  const selectedCount = localTransactions.filter(t => t.is_selected).length;
  const totalAmount = localTransactions
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

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && step !== 'upload') {
        // Ask confirmation before closing mid-wizard
        handleCancel();
      } else {
        onOpenChange(isOpen);
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload your bank statement to automatically extract and categorize expenses
          </DialogDescription>
        </DialogHeader>

        {/* Progress steps */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 rounded-lg">
          {STEPS.map((s, index) => (
            <div 
              key={s.key}
              className={cn(
                'flex items-center gap-2',
                index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                index < currentStepIndex && 'bg-primary text-primary-foreground',
                index === currentStepIndex && 'bg-primary/20 text-primary border-2 border-primary',
                index > currentStepIndex && 'bg-muted'
              )}>
                {index < currentStepIndex ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  s.icon
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {step === 'upload' && (
            <StatementUploader
              onUpload={handleUpload}
              isUploading={uploadMutation.isPending}
              uploadProgress={uploadProgress}
            />
          )}

          {step === 'processing' && (
            <div className="text-center py-12 space-y-6">
              <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {parseMutation.isPending ? 'Extracting transactions...' : 'Processing...'}
                </h3>
                <p className="text-muted-foreground">
                  Using AI to read and extract transactions from your statement
                </p>
                {importRecord?.bank_name && (
                  <p className="text-sm text-primary">
                    Detected: {importRecord.bank_name} Bank Statement
                  </p>
                )}
              </div>
              {importRecord?.status === 'failed' && (
                <Alert variant="destructive" className="max-w-md mx-auto">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Extraction Failed</AlertTitle>
                  <AlertDescription>
                    {importRecord.error_message || 'Failed to extract transactions from the statement'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {(step === 'preview' || step === 'confirm') && (
            <div className="space-y-4">
              {importRecord && (
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{importRecord.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {importRecord.bank_name || 'Unknown Bank'} • 
                        {importRecord.total_transactions} transactions found
                      </p>
                    </div>
                  </div>
                  {importRecord.statement_period_start && importRecord.statement_period_end && (
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Statement Period</p>
                      <p className="font-medium text-foreground">
                        {new Date(importRecord.statement_period_start).toLocaleDateString()} - 
                        {new Date(importRecord.statement_period_end).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <TransactionPreview
                transactions={localTransactions}
                categories={categories}
                onTransactionUpdate={handleTransactionUpdate}
                onSelectionChange={handleSelectionChange}
                onSelectAll={handleSelectAll}
                showCategories={step === 'confirm'}
              />
            </div>
          )}

          {step === 'categorize' && (
            <div className="text-center py-12 space-y-6">
              <div className="relative">
                <Sparkles className="h-16 w-16 mx-auto text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">AI Categorization in Progress</h3>
                <p className="text-muted-foreground">
                  Analyzing transactions and assigning categories based on your spending patterns
                </p>
              </div>
              <Progress value={categorizeMutation.isPending ? 60 : 100} className="w-48 mx-auto" />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            {step === 'preview' && (
              <Button onClick={handleCategorize} disabled={categorizeMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />
                Categorize with AI
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {step === 'confirm' && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Importing {selectedCount} transactions
                  </p>
                  <p className="font-semibold text-destructive">
                    Total: {formatCurrency(totalAmount)}
                  </p>
                </div>
                <Button 
                  onClick={handleImport} 
                  disabled={importMutation.isPending || selectedCount === 0}
                  className="gap-2"
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Import Expenses
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
