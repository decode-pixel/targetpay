import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
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
        break;
    }
  }, [importRecord?.status, refetchTransactions]);

  const handleUpload = async (file: File) => {
    setUploadProgress(0);
    
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadMutation.mutateAsync(file);
      setImportId(result.id);
      setUploadProgress(100);
      
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

  const content = (
    <>
      {/* Progress steps - simplified for mobile */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 bg-muted/30 rounded-lg mb-4 overflow-x-auto">
        {STEPS.map((s, index) => (
          <div 
            key={s.key}
            className={cn(
              'flex items-center gap-1 md:gap-2 shrink-0',
              index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className={cn(
              'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium',
              index < currentStepIndex && 'bg-primary text-primary-foreground',
              index === currentStepIndex && 'bg-primary/20 text-primary border-2 border-primary',
              index > currentStepIndex && 'bg-muted'
            )}>
              {index < currentStepIndex ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                s.icon
              )}
            </div>
            <span className="text-xs md:text-sm font-medium hidden sm:inline">{s.label}</span>
            {index < STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {step === 'upload' && (
          <StatementUploader
            onUpload={handleUpload}
            isUploading={uploadMutation.isPending}
            uploadProgress={uploadProgress}
          />
        )}

        {step === 'processing' && (
          <div className="text-center py-8 md:py-12 space-y-4 md:space-y-6">
            <Loader2 className="h-12 w-12 md:h-16 md:w-16 mx-auto text-primary animate-spin" />
            <div className="space-y-2">
              <h3 className="text-base md:text-lg font-semibold">
                {parseMutation.isPending ? 'Extracting transactions...' : 'Processing...'}
              </h3>
              <p className="text-sm text-muted-foreground px-4">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{importRecord.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {importRecord.bank_name || 'Unknown Bank'} • {importRecord.total_transactions} transactions
                    </p>
                  </div>
                </div>
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
          <div className="text-center py-8 md:py-12 space-y-4 md:space-y-6">
            <div className="relative">
              <Sparkles className="h-12 w-12 md:h-16 md:w-16 mx-auto text-primary animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base md:text-lg font-semibold">AI Categorization in Progress</h3>
              <p className="text-sm text-muted-foreground px-4">
                Analyzing transactions and assigning categories
              </p>
            </div>
            <Progress value={categorizeMutation.isPending ? 60 : 100} className="w-48 mx-auto" />
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t mt-4">
        <Button variant="ghost" onClick={handleCancel} className="order-2 sm:order-1">
          Cancel
        </Button>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 order-1 sm:order-2">
          {step === 'preview' && (
            <Button 
              onClick={handleCategorize} 
              disabled={categorizeMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Categorize with AI
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 'confirm' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="text-center sm:text-right">
                <p className="text-xs text-muted-foreground">
                  Importing {selectedCount} transactions
                </p>
                <p className="font-semibold text-destructive text-sm">
                  Total: {formatCurrency(totalAmount)}
                </p>
              </div>
              <Button 
                onClick={handleImport} 
                disabled={importMutation.isPending || selectedCount === 0}
                className="gap-2 w-full sm:w-auto"
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
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(isOpen) => {
        if (!isOpen && step !== 'upload') {
          handleCancel();
        } else {
          onOpenChange(isOpen);
        }
      }}>
        <DrawerContent className="max-h-[95vh] flex flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle>Import Bank Statement</DrawerTitle>
            <DrawerDescription>
              Upload to extract and categorize expenses
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && step !== 'upload') {
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
        {content}
      </DialogContent>
    </Dialog>
  );
}
