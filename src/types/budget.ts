export type CategoryType = 'needs' | 'wants' | 'savings';
export type BudgetMode = 'flexible' | 'strict' | 'guided';

export interface UserFinancialSettings {
  id: string;
  user_id: string;
  monthly_income: number | null;
  budget_mode: BudgetMode;
  needs_percentage: number;
  wants_percentage: number;
  savings_percentage: number;
  min_savings_target: number;
  show_budget_suggestions: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetAllocation {
  needs: number;
  wants: number;
  savings: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  spent: number;
  budget: number;
  percentage: number;
  isOverBudget: boolean;
}

export interface BudgetHealthMetrics {
  score: number; // 0-100
  needsUsage: number;
  wantsUsage: number;
  savingsProgress: number;
  overBudgetCategories: number;
  underUtilizedCategories: number;
  suggestions: BudgetSuggestion[];
}

export interface BudgetSuggestion {
  id: string;
  type: 'warning' | 'info' | 'success' | 'reallocation';
  title: string;
  message: string;
  action?: {
    label: string;
    categoryId?: string;
    suggestedAmount?: number;
  };
}

export interface SpendingTrend {
  month: string;
  categoryId: string;
  amount: number;
}

// Default category type mapping based on common category names
export const DEFAULT_CATEGORY_TYPES: Record<string, CategoryType> = {
  // Needs
  'food & dining': 'needs',
  'food': 'needs',
  'groceries': 'needs',
  'rent': 'needs',
  'transportation': 'needs',
  'transport': 'needs',
  'bills & utilities': 'needs',
  'utilities': 'needs',
  'healthcare': 'needs',
  'medical': 'needs',
  'insurance': 'needs',
  'education': 'needs',
  
  // Wants
  'shopping': 'wants',
  'entertainment': 'wants',
  'travel': 'wants',
  'dining out': 'wants',
  'subscriptions': 'wants',
  'hobbies': 'wants',
  'personal care': 'wants',
  
  // Savings
  'savings': 'savings',
  'investments': 'savings',
  'emergency fund': 'savings',
  'retirement': 'savings',
};

export function inferCategoryType(categoryName: string): CategoryType {
  const normalized = categoryName.toLowerCase().trim();
  
  // Check exact match first
  if (DEFAULT_CATEGORY_TYPES[normalized]) {
    return DEFAULT_CATEGORY_TYPES[normalized];
  }
  
  // Check partial matches
  for (const [key, type] of Object.entries(DEFAULT_CATEGORY_TYPES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return type;
    }
  }
  
  // Default to wants
  return 'wants';
}
