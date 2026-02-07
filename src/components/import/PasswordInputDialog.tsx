import { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PasswordInputDialogProps {
  fileName: string;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
  error?: string | null;
  className?: string;
}

export default function PasswordInputDialog({
  fileName,
  onSubmit,
  onCancel,
  isProcessing,
  error,
  className,
}: PasswordInputDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isProcessing) return;
    await onSubmit(password);
    // Clear password from memory immediately after use
    setPassword('');
  };

  return (
    <Card className={cn('border-border/50 border-2 border-primary/20', className)}>
      <CardHeader className="text-center space-y-3">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-lg">Password Protected PDF</CardTitle>
          <CardDescription className="mt-2 text-base">
            This bank statement is password protected.
            <br />
            <span className="text-foreground font-medium">Enter password to continue.</span>
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted rounded-lg text-center">
          <p className="text-sm font-medium truncate">{fileName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-password">Enter PDF Password</Label>
            <div className="relative">
              <Input
                id="pdf-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="h-12 pr-10"
                autoFocus
                autoComplete="off"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-fade-in">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 h-11"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11"
              disabled={!password.trim() || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Unlock & Process
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Security notice */}
        <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Your password is secure</p>
            <p className="mt-0.5">
              The password is used only to decrypt this file and is never stored. 
              It is discarded immediately after extraction.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
