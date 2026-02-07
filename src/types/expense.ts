export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank' | 'wallet';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  monthly_budget: number | null;
  budget_alert_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  date: string;
  payment_method: PaymentMethod;
  note: string | null;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface ExpenseDraft {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number | null;
  date: string | null;
  payment_method: PaymentMethod | null;
  note: string | null;
  updated_at: string;
}

export interface ExpenseFilters {
  month?: string; // YYYY-MM format
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface MonthlyStats {
  totalExpense: number;
  remainingBudget: number;
  totalBudget: number;
  highestCategory: {
    name: string;
    amount: number;
    color: string;
  } | null;
  categoryBreakdown: {
    category: Category;
    amount: number;
    percentage: number;
  }[];
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'banknote' },
  { value: 'upi', label: 'UPI', icon: 'smartphone' },
  { value: 'card', label: 'Card', icon: 'credit-card' },
  { value: 'bank', label: 'Bank Transfer', icon: 'building-2' },
  { value: 'wallet', label: 'Wallet', icon: 'wallet' },
];

export const CATEGORY_ICONS = [
  'utensils', 'car', 'shopping-bag', 'gamepad-2', 'receipt', 
  'heart-pulse', 'graduation-cap', 'more-horizontal', 'home',
  'plane', 'gift', 'briefcase', 'music', 'camera', 'dumbbell',
  'coffee', 'book', 'shirt', 'baby', 'dog', 'flower-2', 'fuel'
];

export const CATEGORY_COLORS = [
  '#F97316', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444',
  '#10B981', '#06B6D4', '#6B7280', '#F59E0B', '#84CC16',
  '#14B8A6', '#6366F1', '#D946EF', '#F43F5E', '#0EA5E9'
];
