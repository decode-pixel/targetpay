import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, FileText, Loader2, CheckCircle2, XCircle, ChevronRight, Sparkles, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer';
import StatementUploader from './StatementUploader';
import TransactionPreview from './TransactionPreview';
import MonthGroupedPreview from './MonthGroupedPreview';
import PasswordInputDialog from './PasswordInputDialog';
import SuggestedCategories from '@/components/categories/SuggestedCategories';
import { ImportWizardStep, ExtractedTransaction } from '@/types/import';
import { useCategories } from '@/hooks/useCategories';
import {
  useUploadStatement, useParseStatement, useCategorizeTransactions,
  useImportTransactions, useStatementImport, useExtractedTransactions,
  useUpdateExtractedTransaction, useDeleteImport,
} from '@/hooks/useStatementImport';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardState = 
  | 'idle'
  | 'uploading'
  | 'checking_encryption'
  | 'waiting_password'
  | 'validating_password'
  | 'extracting'
  | 'preview_ready'
  | 'categorizing'
  | 'confirm_ready'
  | 'error';

const STEP_MAP: Record<WizardState, ImportWizardStep> = {
  idle: 'upload',
  uploading: 'upload',
  checking_encryption: 'processing',
  waiting_password: 'password_required',
  validating_password: 'processing',
  extracting: 'processing',
  preview_ready: 'preview',
  categorizing: 'categorize',
  confirm_ready: 'confirm',
  error: 'processing',
};

const STEPS: { key: ImportWizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'upload', label: 'Upload', icon: <Upload className="h-4 w-4" /> },
  { key: 'processing', label: 'Extract', icon: <Loader2 className="h-4 w-4" /> },
  { key: 'preview', label: 'Preview', icon: <FileText className="h-4 w-4" /> },
  { key: 'categorize', label: 'Categorize', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'confirm', label: 'Confirm', icon: <Calendar className="h-4 w-4" /> },
];

const TIMEOUT_MS = 90_000;

export default function ImportWizardDialog({ open, onOpenChange }: ImportWizardDialogProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [wizardState, setWizardState] = useState<WizardState>('idle');
  const [importId, setImportId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localTransactions, setLocalTransactions] = useState<ExtractedTransaction[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: importRecord } = useStatementImport(importId);
  const { data: extractedTransactions = [], refetch: refetchTransactions } = useExtractedTransactions(importId);
  
  const uploadMutation = useUploadStatement();
  const parseMutation = useParseStatement();
  const categorizeMutation = useCategorizeTransactions();
  const importMutation = useImportTransactions();
  const updateTransaction = useUpdateExtractedTransaction();
  const deleteImport = useDeleteImport();

  const step = STEP_MAP[wizardState];

  // Cleanup
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // Sync extracted transactions
  useEffect(() => {
    if (extractedTransactions.length > 0) setLocalTransactions(extractedTransactions);
  }, [extractedTransactions]);

  // Timeout helper
  const startTimeout = useCallback((msg: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setErrorMessage(msg);
      setWizardState('error');
      setStatusText('');
    }, TIMEOUT_MS);
  }, []);

  const clearTimeout_ = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  // ── POLL-DRIVEN STATE MACHINE ──
  // Use a ref to avoid stale closure issues with wizardState
  const wizardStateRef = useRef(wizardState);
  wizardStateRef.current = wizardState;

  useEffect(() => {
    if (!importRecord) return;
    const s = importRecord.status;
    const currentState = wizardStateRef.current;

    // Don't process if we're idle or uploading (not yet submitted to backend)
    if (currentState === 'idle' || currentState === 'uploading') return;

    if (s === 'processing' && (currentState === 'checking_encryption' || currentState === 'validating_password' || currentState === 'extracting')) {
      setWizardState('extracting');
      setStatusText('Extracting transactions with AI...');
    } else if (s === 'password_required' && currentState !== 'waiting_password') {
      clearTimeout_();
      if (currentState === 'validating_password') {
        setPasswordError(importRecord.error_message || 'Incorrect password. Please try again.');
      }
      setWizardState('waiting_password');
      setStatusText('');
    } else if (s === 'password_required' && currentState === 'waiting_password') {
      // Already waiting, just update error if changed
    } else if (s === 'extracted') {
      clearTimeout_();
      setErrorMessage(null);
      setWizardState('preview_ready');
      refetchTransactions();
    } else if (s === 'categorizing') {
      setWizardState('categorizing');
    } else if (s === 'ready') {
      clearTimeout_();
      setWizardState('confirm_ready');
      refetchTransactions();
    } else if (s === 'failed') {
      clearTimeout_();
      setErrorMessage(importRecord.error_message || 'Processing failed.');
      setWizardState('error');
      setStatusText('');
    }
  }, [importRecord?.status, importRecord?.updated_at, importRecord?.error_message, refetchTransactions, clearTimeout_]);

  // ── HANDLERS ──
  const handleUpload = async (file: File) => {
    setUploadProgress(0);
    setErrorMessage(null);
    setWizardState('uploading');
    setStatusText('Uploading...');

    const interval = setInterval(() => setUploadProgress(p => Math.min(p + 10, 90)), 200);

    try {
      const result = await uploadMutation.mutateAsync(file);
      setImportId(result.id);
      setUploadProgress(100);
      setWizardState('checking_encryption');
      setStatusText('Checking for encryption...');
      startTimeout('Processing timed out. Please try again.');

      // Fire parse — polling handles state transitions
      parseMutation.mutate({ importId: result.id }, {
        onSuccess: (res) => {
          if (res.passwordRequired) {
            clearTimeout_();
            setWizardState('waiting_password');
            setStatusText('');
          }
        },
        onError: (err) => {
          clearTimeout_();
          setErrorMessage(err instanceof Error ? err.message : 'Processing failed.');
          setWizardState('error');
        },
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed.');
      setWizardState('error');
    } finally {
      clearInterval(interval);
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    if (!importId || wizardState === 'validating_password') return;
    setPasswordError(null);
    setWizardState('validating_password');
    setStatusText('Unlocking and extracting...');
    startTimeout('Processing timed out. The password may be incorrect.');

    parseMutation.mutate({ importId, password }, {
      onSuccess: (res) => {
        if (res.passwordRequired) {
          clearTimeout_();
          setPasswordError(res.message || 'Incorrect password. Please try again.');
          setWizardState('waiting_password');
          setStatusText('');
        }
        // else polling will transition to extracting → preview_ready
      },
      onError: (err) => {
        clearTimeout_();
        setPasswordError(err instanceof Error ? err.message : 'Failed. Please try again.');
        setWizardState('waiting_password');
        setStatusText('');
      },
    });
  };

  const handleCancelPassword = async () => {
    clearTimeout_();
    if (importId) await deleteImport.mutateAsync(importId).catch(() => {});
    resetWizard();
    onOpenChange(false);
  };

  const handleCategorize = async () => {
    if (!importId) return;
    setWizardState('categorizing');
    try {
      const result = await categorizeMutation.mutateAsync(importId);
      if (result.suggestedCategories?.length) setSuggestedCategories(result.suggestedCategories);
    } catch {
      // Categorization failure is non-blocking — user can still proceed
      setWizardState('confirm_ready');
    }
  };

  const handleImport = async () => {
    if (!importId) return;
    const updates = localTransactions.filter(t => t.is_selected).map(t => ({
      id: t.id,
      category_id: t.suggested_category_id,
    }));
    await importMutation.mutateAsync({ importId, transactions: updates });
    onOpenChange(false);
    navigate('/expenses');
  };

  const handleCancel = async () => {
    clearTimeout_();
    if (importId) await deleteImport.mutateAsync(importId).catch(() => {});
    resetWizard();
    onOpenChange(false);
  };

  const handleRetry = () => {
    clearTimeout_();
    if (importId) deleteImport.mutate(importId);
    resetWizard();
  };

  const resetWizard = () => {
    clearTimeout_();
    setWizardState('idle');
    setImportId(null);
    setUploadProgress(0);
    setLocalTransactions([]);
    setSuggestedCategories([]);
    setPasswordError(null);
    setErrorMessage(null);
    setStatusText('');
  };

  const handleTransactionUpdate = useCallback((id: string, updates: Partial<ExtractedTransaction>) => {
    setLocalTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    updateTransaction.mutate({ id, ...updates } as any);
  }, [updateTransaction]);

  const handleSelectionChange = useCallback((id: string, selected: boolean) => {
    setLocalTransactions(prev => prev.map(t => t.id === id ? { ...t, is_selected: selected } : t));
    updateTransaction.mutate({ id, is_selected: selected } as any);
  }, [updateTransaction]);

  const handleSelectAll = useCallback((selected: boolean) => {
    setLocalTransactions(prev => prev.map(t => ({ ...t, is_selected: selected })));
    localTransactions.forEach(t => updateTransaction.mutate({ id: t.id, is_selected: selected } as any));
  }, [localTransactions, updateTransaction]);

  const selectedCount = localTransactions.filter(t => t.is_selected).length;
  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const content = (
    <>
      {/* Progress steps */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 bg-muted/30 rounded-lg mb-4 overflow-x-auto">
        {STEPS.map((s, index) => (
          <div key={s.key} className={cn(
            'flex items-center gap-1 md:gap-2 shrink-0',
            index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
          )}>
            <div className={cn(
              'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium',
              index < currentStepIndex && 'bg-primary text-primary-foreground',
              index === currentStepIndex && 'bg-primary/20 text-primary border-2 border-primary',
              index > currentStepIndex && 'bg-muted'
            )}>
              {index < currentStepIndex ? <CheckCircle2 className="h-4 w-4" /> : s.icon}
            </div>
            <span className="text-xs md:text-sm font-medium hidden sm:inline">{s.label}</span>
            {index < STEPS.length - 1 && <ChevronRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* UPLOAD */}
        {step === 'upload' && (
          <StatementUploader
            onUpload={handleUpload}
            isUploading={wizardState === 'uploading'}
            uploadProgress={uploadProgress}
          />
        )}

        {/* PROCESSING / ERROR */}
        {step === 'processing' && (
          <div className="text-center py-8 md:py-12 space-y-4 md:space-y-6">
            {wizardState === 'error' ? (
              <>
                <XCircle className="h-12 w-12 md:h-16 md:w-16 mx-auto text-destructive" />
                <Alert variant="destructive" className="max-w-md mx-auto">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Processing Failed</AlertTitle>
                  <AlertDescription>{errorMessage || 'An error occurred.'}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={handleRetry}>Try Again</Button>
              </>
            ) : (
              <>
                <Loader2 className="h-12 w-12 md:h-16 md:w-16 mx-auto text-primary animate-spin" />
                <div className="space-y-2">
                  <h3 className="text-base md:text-lg font-semibold">{statusText || 'Processing...'}</h3>
                  <p className="text-sm text-muted-foreground px-4">
                    AI is reading and extracting transactions from your statement
                  </p>
                  {importRecord?.bank_name && (
                    <p className="text-sm text-primary">Detected: {importRecord.bank_name} Bank Statement</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* PASSWORD */}
        {step === 'password_required' && importRecord && (
          <PasswordInputDialog
            fileName={importRecord.file_name}
            onSubmit={handlePasswordSubmit}
            onCancel={handleCancelPassword}
            isProcessing={wizardState === 'validating_password'}
            error={passwordError}
          />
        )}

        {/* PREVIEW */}
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

        {/* CATEGORIZE */}
        {step === 'categorize' && (
          <div className="text-center py-8 md:py-12 space-y-4 md:space-y-6">
            <Sparkles className="h-12 w-12 md:h-16 md:w-16 mx-auto text-primary animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-base md:text-lg font-semibold">AI Categorization in Progress</h3>
              <p className="text-sm text-muted-foreground px-4">Analyzing transactions and assigning categories</p>
            </div>
            <Progress value={categorizeMutation.isPending ? 60 : 100} className="w-48 mx-auto" />
          </div>
        )}

        {/* CONFIRM */}
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

      {/* Footer */}
      {step !== 'confirm' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t mt-4">
          <Button variant="ghost" onClick={handleCancel} className="order-2 sm:order-1">Cancel</Button>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 order-1 sm:order-2">
            {step === 'preview' && (
              <Button onClick={handleCategorize} disabled={categorizeMutation.isPending} className="w-full sm:w-auto">
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
        if (!isOpen && wizardState !== 'idle') handleCancel();
        else onOpenChange(isOpen);
      }}>
        <DrawerContent className="max-h-[95vh] flex flex-col">
          <DrawerHeader className="text-left">
            <DrawerTitle>Import Bank Statement</DrawerTitle>
            <DrawerDescription>Upload to extract and categorize expenses</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && wizardState !== 'idle') handleCancel();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>Upload your bank statement to automatically extract and categorize expenses</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
