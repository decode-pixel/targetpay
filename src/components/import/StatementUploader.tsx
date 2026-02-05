import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StatementUploaderProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadProgress?: number;
}

export default function StatementUploader({ 
  onUpload, 
  isUploading, 
  uploadProgress = 0 
}: StatementUploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
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

    try {
      await onUpload(acceptedFiles[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          isUploading && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Uploading statement...</p>
              <Progress value={uploadProgress} className="h-2 w-48 mx-auto" />
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          </div>
        ) : isDragActive ? (
          <div className="space-y-2">
            <Upload className="h-12 w-12 mx-auto text-primary" />
            <p className="text-sm font-medium">Drop your statement here</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-medium">Drop your bank statement here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-muted rounded">PDF format</span>
              <span className="px-2 py-1 bg-muted rounded">Max 10MB</span>
              <span className="px-2 py-1 bg-muted rounded">OCR supported</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Supports: SBI, HDFC, ICICI, Axis Bank
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>🔒 Your statement is processed securely and deleted after 24 hours</p>
        <p>We never store or share your banking credentials</p>
      </div>
    </div>
  );
}
