import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, Loader2, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIsMobile } from '@/hooks/use-mobile';

interface StatementUploaderProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadProgress?: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function StatementUploader({ 
  onUpload, 
  isUploading, 
  uploadProgress = 0 
}: StatementUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File size must be less than 10MB');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Only PDF files are supported');
      } else {
        setError('Invalid file');
      }
      return;
    }

    if (acceptedFiles.length === 0) return;
    setSelectedFile(acceptedFiles[0]);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      await onUpload(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled: isUploading,
    noClick: isMobile,
  });

  const handleMobileTap = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileDrop([files[0]], []);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input for mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 md:p-8 text-center transition-all duration-200',
          'min-h-[160px] md:min-h-[200px] flex flex-col items-center justify-center',
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          isUploading && 'pointer-events-none opacity-60',
          error && 'border-destructive/50 bg-destructive/5',
          !isMobile && 'cursor-pointer'
        )}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="space-y-4 w-full max-w-xs">
            <Loader2 className="h-10 w-10 md:h-12 md:w-12 mx-auto text-primary animate-spin" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {uploadProgress < 100 ? 'Uploading statement...' : 'Processing with AI...'}
              </p>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg w-full max-w-xs">
              <FileText className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="font-medium truncate text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">Ready to process</span>
            </div>
          </div>
        ) : isDragActive ? (
          <div className="space-y-2">
            <Upload className="h-10 w-10 md:h-12 md:w-12 mx-auto text-primary" />
            <p className="text-sm font-medium">Drop your statement here</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
            </div>
            
            {isMobile ? (
              <>
                <Button 
                  type="button"
                  variant="outline" 
                  className="h-12 px-6 touch-manipulation"
                  onClick={(e) => { e.stopPropagation(); handleMobileTap(); }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Select PDF File
                </Button>
                <p className="text-sm text-muted-foreground">PDF files up to 10MB</p>
              </>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Drop your bank statement here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            )}
            
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-muted rounded">PDF format</span>
              <span className="px-2 py-1 bg-muted rounded">Max 10MB</span>
              <span className="px-2 py-1 bg-muted rounded">OCR supported</span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['SBI', 'HDFC', 'ICICI', 'Axis'].map((bank) => (
                <span key={bank} className="px-2 py-1 bg-muted/50 rounded text-xs text-muted-foreground">
                  {bank}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload button */}
      {selectedFile && !isUploading && (
        <Button 
          onClick={handleUpload} 
          className="w-full h-12 text-base animate-fade-in touch-manipulation"
        >
          <Upload className="mr-2 h-5 w-5" />
          Process Statement
        </Button>
      )}

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>🔒 Your statement is processed securely and deleted after 24 hours</p>
        <p>We never store or share your banking credentials</p>
      </div>
    </div>
  );
}
