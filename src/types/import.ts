export interface StatementImport {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_hash: string;
  bank_name: string | null;
  statement_period_start: string | null;
  statement_period_end: string | null;
  total_transactions: number;
  imported_transactions: number;
  status: 'pending' | 'processing' | 'extracted' | 'categorizing' | 'ready' | 'completed' | 'failed';
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractedTransaction {
  id: string;
  import_id: string;
  user_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'debit' | 'credit';
  balance: number | null;
  raw_text: string | null;
  suggested_category_id: string | null;
  ai_confidence: number | null;
  is_selected: boolean;
  is_duplicate: boolean;
  duplicate_of: string | null;
  created_at: string;
  // Joined data
  suggested_category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
}

export type ImportWizardStep = 'upload' | 'processing' | 'preview' | 'categorize' | 'confirm';
