import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Sparkles,
  Calendar,
  Lock
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
import MonthGroupedPreview from './MonthGroupedPreview';
import PasswordInputDialog from './PasswordInputDialog';
import SuggestedCategories from '@/components/categories/SuggestedCategories';
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
  { key: 'confirm', label: 'Confirm', icon: <Calendar className="h-4 w-4" /> },
];

// Max time to wait for backend before showing timeout error
const PROCESSING_TIMEOUT_MS = 120_000; // 2 minutes

export default function ImportWizardDialog({ open, onOpenChange }: ImportWizardDialogProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [step, setStep] = useState<ImportWizardStep>('upload');
  const [importId, setImportId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localTransactions, setLocalTransactions] = useState<ExtractedTransaction[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingStartRef = useRef<number | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: importRecord, refetch: refetchImport } = useStatementImport(importId);
  const { data: extractedTransactions = [], refetch: refetchTransactions } = useExtractedTransactions(importId);
  
  const uploadMutation = useUploadStatement();
  const parseMutation = useParseStatement();
  const categorizeMutation = useCategorizeTransactions();
  const importMutation = useImportTransactions();
  const updateTransaction = useUpdateExtractedTransaction();
  const deleteImport = useDeleteImport();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Sync local transactions with fetched data
  useEffect(() => {
    if (extractedTransactions.length > 0) {
      setLocalTransactions(extractedTransactions);
    }
  }, [extractedTransactions]);

  // Start a processing timeout - if backend doesn't respond within limit, show error
  const startProcessingTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    processingStartRef.current = Date.now();
    timeoutRef.current = setTimeout(() => {
      setProcessingError('Processing timed out. Please try again.');
      setProcessingStatus('');
      setIsSubmittingPassword(false);
      setStep('processing'); // Show error in processing view
    }, PROCESSING_TIMEOUT_MS);
  }, []);

  const clearProcessingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    processingStartRef.current = null;
  }, []);

  // Watch import status from polling and advance steps
  useEffect(() => {
    if (!importRecord) return;

    switch (importRecord.status) {
      case 'pending':
        setStep('processing');
        setProcessingStatus('Checking password protection...');
        break;
      case 'processing':
        setStep('processing');
        setProcessingStatus('Extracting transactions...');
        setProcessingError(null);
        break;
      case 'password_required':
        clearProcessingTimeout();
        setStep('password_required');
        setProcessingStatus('');
        // If we were submitting a password and got back to password_required, it was wrong
        if (isSubmittingPassword) {
          setPasswordError(importRecord.error_message || 'Incorrect password. Please try again.');
          setIsSubmittingPassword(false);
        }
        break;
      case 'extracted':
        clearProcessingTimeout();
        setProcessingError(null);
        setStep('preview');
        refetchTransactions();
        break;
      case 'categorizing':
        setStep('categorize');
        break;
      case 'ready':
        clearProcessingTimeout();
        setStep('confirm');
        refetchTransactions();
        break;
      case 'failed':
        clearProcessingTimeout();
        setProcessingError(importRecord.error_message || 'Failed to process statement.');
        setProcessingStatus('');
        setIsSubmittingPassword(false);
        setStep('processing');
        break;
    }
  }, [importRecord?.status, importRecord?.error_message, importRecord?.updated_at, refetchTransactions, clearProcessingTimeout, isSubmittingPassword]);

  const handleUpload = async (file: File) => {
    setUploadProgress(0);
    setProcessingError(null);
    setProcessingStatus('Uploading statement...');
    
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadMutation.mutateAsync(file);
      setImportId(result.id);
      setUploadProgress(100);
      setStep('processing');
      setProcessingStatus('Checking password protection...');

      // Start timeout protection
      startProcessingTimeout();

      // Fire-and-forget: don't await the parse call
      // Polling will detect status changes (password_required, extracted, failed)
      parseMutation.mutate(
        { importId: result.id },
        {
          onSuccess: (parseResult) => {
            if (parseResult.passwordRequired) {
              clearProcessingTimeout();
              setStep('password_required');
              setProcessingStatus('');
            }
            // Other states handled by polling
          },
          onError: (error) => {
            clearProcessingTimeout();
            setProcessingError(error instanceof Error ? error.message : 'Failed to process statement.');
            setProcessingStatus('');
          },
        }
      );
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Upload failed.');
      setProcessingStatus('');
    } finally {
      clearInterval(progressInterval);
    }
  };
  
  const handlePasswordSubmit = async (password: string) => {
    if (!importId || isSubmittingPassword) return;
    setPasswordError(null);
    setIsSubmittingPassword(true);
    setProcessingStatus('Unlocking PDF...');

    // Start timeout for password validation
    startProcessingTimeout();

    // Fire-and-forget: don't await
    parseMutation.mutate(
      { importId, password },
      {
        onSuccess: (result) => {
          if (result.passwordRequired) {
            // Wrong password - stay on password screen
            clearProcessingTimeout();
            setPasswordError(result.message || 'Incorrect password. Please try again.');
            setProcessingStatus('');
            setIsSubmittingPassword(false);
            refetchImport();
          } else {
            // Correct password - move to processing, polling will advance to preview
            setStep('processing');
            setProcessingStatus('Extracting transactions...');
            // isSubmittingPassword stays true until polling detects extracted/failed
          }
        },
        onError: (error) => {
          clearProcessingTimeout();
          setPasswordError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
          setProcessingStatus('');
          setIsSubmittingPassword(false);
        },
      }
    );
  };

  const handleCancelPassword = async () => {
    clearProcessingTimeout();
    setIsSubmittingPassword(false);
    setPasswordError(null);
    setProcessingStatus('');
    await handleCancel();
  };

  const handleCategorize = async () => {
    if (!importId) return;
    setStep('categorize');
    const result = await categorizeMutation.mutateAsync(importId);
    if (result.suggestedCategories && result.suggestedCategories.length > 0) {
      setSuggestedCategories(result.suggestedCategories);
    }
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
    clearProcessingTimeout();
    if (importId) {
      await deleteImport.mutateAsync(importId);
    }
    resetWizard();
    onOpenChange(false);
  };

  const handleRetry = () => {
    clearProcessingTimeout();
    setProcessingError(null);
    setProcessingStatus('');
    setIsSubmittingPassword(false);
    setPasswordError(null);
    if (importId) {
      deleteImport.mutate(importId);
    }
    setImportId(null);
    setStep('upload');
  };

  const resetWizard = () => {
    clearProcessingTimeout();
    setStep('upload');
    setImportId(null);
    setUploadProgress(0);
    setLocalTransactions([]);
    setSuggestedCategories([]);
    setPasswordError(null);
    setProcessingStatus('');
    setIsSubmittingPassword(false);
    setProcessingError(null);
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
      {/* Progress steps */}
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
            {(processingError || importRecord?.status === 'failed') ? (
              <>
                <XCircle className="h-12 w-12 md:h-16 md:w-16 mx-auto text-destructive" />
                <Alert variant="destructive" className="max-w-md mx-auto">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Processing Failed</AlertTitle>
                  <AlertDescription>
                    {processingError || importRecord?.error_message || 'Failed to extract transactions from the statement'}
                  </AlertDescription>
                </Alert>
                <Button variant="outline" onClick={handleRetry}>
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-12 w-12 md:h-16 md:w-16 mx-auto text-primary animate-spin" />
                <div className="space-y-2">
                  <h3 className="text-base md:text-lg font-semibold">
                    {processingStatus || 'Processing...'}
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
              </>
            )}
          </div>
        )}

        {step === 'password_required' && importRecord && (
          <PasswordInputDialog
            fileName={importRecord.file_name}
            onSubmit={handlePasswordSubmit}
            onCancel={handleCancelPassword}
            isProcessing={isSubmittingPassword}
            error={passwordError}
          />
        )}

        {step === 'preview' && (
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
              showCategories={false}
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

        {step === 'confirm' && (
          <div className="space-y-4">
            {suggestedCategories.length > 0 && (
              <SuggestedCategories
                suggestions={suggestedCategories}
                onDismiss={() => setSuggestedCategories([])}
              />
            )}

            <MonthGroupedPreview
              transactions={localTransactions.filter(t => t.is_selected)}
              onConfirm={handleImport}
              onCancel={handleCancel}
              isImporting={importMutation.isPending}
            />
          </div>
        )}
      </div>

      {/* Footer actions */}
      {step !== 'confirm' && (
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
          </div>
        </div>
      )}
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
