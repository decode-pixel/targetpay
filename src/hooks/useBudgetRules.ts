import { useMemo } from 'react';
import { format, subMonths, parseISO } from 'date-fns';
import { useCategories } from './useCategories';
import { useExpenses } from './useExpenses';
import { useFinancialSettings } from './useFinancialSettings';
import { useAllEffectiveBudgets } from './useCategoryBudgets';
import { 
  BudgetHealthMetrics, 
  BudgetSuggestion, 
  CategorySpending,
  CategoryType,
  BudgetMode,
} from '@/types/budget';

interface UseBudgetRulesOptions {
  month: string; // YYYY-MM format
}

export function useBudgetRules({ month }: UseBudgetRulesOptions) {
  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useExpenses({ month });
  const { data: settings } = useFinancialSettings();
  const { budgets, hasMonthSpecificBudget } = useAllEffectiveBudgets(month, categories);

  const budgetMode: BudgetMode = settings?.budget_mode || 'flexible';

  // Calculate spending per category
  const categorySpending = useMemo(() => {
    const spending: Record<string, number> = {};
    expenses.forEach(exp => {
      if (exp.category_id) {
        spending[exp.category_id] = (spending[exp.category_id] || 0) + Number(exp.amount);
      }
    });
    return spending;
  }, [expenses]);

  // Get spending by category type
  const spendingByType = useMemo(() => {
    const result: Record<CategoryType, number> = { needs: 0, wants: 0, savings: 0 };
    categories.forEach(cat => {
      const type = (cat as any).category_type as CategoryType || 'wants';
      result[type] += categorySpending[cat.id] || 0;
    });
    return result;
  }, [categories, categorySpending]);

  // Get budget by category type
  const budgetByType = useMemo(() => {
    const result: Record<CategoryType, number> = { needs: 0, wants: 0, savings: 0 };
    categories.forEach(cat => {
      const type = (cat as any).category_type as CategoryType || 'wants';
      result[type] += budgets.get(cat.id) || 0;
    });
    return result;
  }, [categories, budgets]);

  // Calculate category spending details
  const categoryDetails: CategorySpending[] = useMemo(() => {
    return categories.map(cat => {
      const spent = categorySpending[cat.id] || 0;
      const budget = budgets.get(cat.id) || 0;
      const percentage = budget > 0 ? (spent / budget) * 100 : 0;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryType: ((cat as any).category_type as CategoryType) || 'wants',
        spent,
        budget,
        percentage,
        isOverBudget: percentage > 100,
      };
    });
  }, [categories, categorySpending, budgets]);

  // Generate budget suggestions - MODE AWARE
  const suggestions = useMemo((): BudgetSuggestion[] => {
    if (!settings?.show_budget_suggestions) return [];
    
    const suggestions: BudgetSuggestion[] = [];
    const income = settings?.monthly_income || 0;
    
    // Thresholds vary by mode
    categoryDetails.forEach(cat => {
      if (cat.budget > 0) {
        if (cat.percentage >= 100) {
          suggestions.push({
            id: `over-${cat.categoryId}`,
            type: budgetMode === 'strict' ? 'warning' : 'warning',
            title: budgetMode === 'strict' 
              ? `⛔ VIOLATION: ${cat.categoryName} exceeded budget`
              : `${cat.categoryName} is over budget`,
            message: budgetMode === 'strict'
              ? `Budget exceeded! Spent ₹${Math.round(cat.spent).toLocaleString()} of ₹${Math.round(cat.budget).toLocaleString()}. Override required for further spending.`
              : `You've spent ₹${Math.round(cat.spent).toLocaleString()} of ₹${Math.round(cat.budget).toLocaleString()} budget.`,
          });
        } else if (cat.percentage >= 90) {
          // All modes show at 90%
          suggestions.push({
            id: `alert90-${cat.categoryId}`,
            type: 'warning',
            title: budgetMode === 'strict'
              ? `⚠️ ${cat.categoryName} at critical 90%`
              : `${cat.categoryName} is at 90%`,
            message: `Only ₹${Math.round(cat.budget - cat.spent).toLocaleString()} remaining in this category.`,
          });
        } else if (cat.percentage >= 70 && budgetMode !== 'flexible') {
          // Guided and Strict show at 70%
          suggestions.push({
            id: `alert70-${cat.categoryId}`,
            type: budgetMode === 'strict' ? 'warning' : 'info',
            title: budgetMode === 'strict'
              ? `⚠️ ${cat.categoryName} approaching limit (${Math.round(cat.percentage)}%)`
              : `${cat.categoryName} is at 70%`,
            message: `Consider slowing down spending in this category.`,
          });
        } else if (cat.percentage >= 50 && budgetMode === 'strict') {
          // Strict shows at 50%
          suggestions.push({
            id: `alert50-${cat.categoryId}`,
            type: 'info',
            title: `${cat.categoryName} is at ${Math.round(cat.percentage)}%`,
            message: `Half of your budget has been used. Plan remaining spending carefully.`,
          });
        }
      }
    });

    // Income-based suggestions
    if (income > 0) {
      const needsTarget = income * (settings?.needs_percentage || 50) / 100;
      const wantsTarget = income * (settings?.wants_percentage || 30) / 100;
      const savingsTarget = income * (settings?.savings_percentage || 20) / 100;

      if (spendingByType.needs > needsTarget) {
        suggestions.push({
          id: 'needs-high',
          type: 'warning',
          title: budgetMode === 'strict' ? '⛔ Needs spending exceeds allocation' : 'Needs spending is high',
          message: `You've spent ${Math.round((spendingByType.needs / income) * 100)}% on needs. Target is ${settings?.needs_percentage}%.`,
        });
      }

      if (spendingByType.wants > wantsTarget) {
        suggestions.push({
          id: 'wants-high',
          type: 'warning',
          title: budgetMode === 'strict' ? '⛔ Wants spending exceeds allocation' : 'Wants spending is high',
          message: `Consider reducing discretionary spending to stay on track.`,
        });
      }

      if (spendingByType.savings < savingsTarget * 0.5 && new Date().getDate() > 15) {
        suggestions.push({
          id: 'savings-low',
          type: 'info',
          title: 'Savings below target',
          message: `You're behind on your savings goal. Consider setting aside more this month.`,
        });
      }
    }

    // Reallocation suggestions
    const underutilized = categoryDetails.filter(c => c.budget > 0 && c.percentage < 30);
    const overbudget = categoryDetails.filter(c => c.isOverBudget);
    
    if (underutilized.length > 0 && overbudget.length > 0) {
      const source = underutilized[0];
      const target = overbudget[0];
      const availableAmount = Math.round(source.budget - source.spent);
      
      if (availableAmount > 0) {
        suggestions.push({
          id: `realloc-${source.categoryId}-${target.categoryId}`,
          type: 'reallocation',
          title: 'Budget reallocation available',
          message: `Move ₹${availableAmount.toLocaleString()} from ${source.categoryName} to ${target.categoryName}?`,
          action: {
            label: 'Reallocate',
            categoryId: target.categoryId,
            suggestedAmount: target.budget + availableAmount,
          },
        });
      }
    }

    return suggestions;
  }, [categoryDetails, settings, spendingByType, budgetMode]);

  // Calculate budget health score - MODE AWARE
  const healthMetrics = useMemo((): BudgetHealthMetrics => {
    const totalBudget = categoryDetails.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = categoryDetails.reduce((sum, c) => sum + c.spent, 0);
    const overBudgetCount = categoryDetails.filter(c => c.isOverBudget).length;
    const underUtilizedCount = categoryDetails.filter(c => c.budget > 0 && c.percentage < 20).length;
    
    let score = 100;
    
    // Mode-aware deductions per over-budget category
    const deductionPerCategory = budgetMode === 'strict' ? 15 : budgetMode === 'guided' ? 10 : 5;
    score -= overBudgetCount * deductionPerCategory;
    
    // Deduct if total spending exceeds total budget
    if (totalBudget > 0 && totalSpent > totalBudget) {
      score -= Math.min(30, ((totalSpent - totalBudget) / totalBudget) * 50);
    }
    
    score -= underUtilizedCount * 2;
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    // Calculate type-based usage
    const income = settings?.monthly_income || 0;
    const needsUsage = budgetByType.needs > 0 
      ? (spendingByType.needs / budgetByType.needs) * 100 
      : (income > 0 ? (spendingByType.needs / (income * 0.5)) * 100 : 0);
    const wantsUsage = budgetByType.wants > 0 
      ? (spendingByType.wants / budgetByType.wants) * 100 
      : (income > 0 ? (spendingByType.wants / (income * 0.3)) * 100 : 0);
    const savingsProgress = settings?.min_savings_target && settings.min_savings_target > 0
      ? Math.min(100, (spendingByType.savings / settings.min_savings_target) * 100)
      : 0;

    return {
      score,
      needsUsage: Math.round(needsUsage),
      wantsUsage: Math.round(wantsUsage),
      savingsProgress: Math.round(savingsProgress),
      overBudgetCategories: overBudgetCount,
      underUtilizedCategories: underUtilizedCount,
      suggestions,
    };
  }, [categoryDetails, settings, budgetByType, spendingByType, suggestions, budgetMode]);

  return {
    categoryDetails,
    spendingByType,
    budgetByType,
    healthMetrics,
    suggestions,
    settings,
    budgetMode,
  };
}

// Hook to get spending trends for the last N months
export function useSpendingTrends(months: number = 3) {
  const { data: categories = [] } = useCategories();
  
  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 0; i < months; i++) {
      keys.push(format(subMonths(now, i), 'yyyy-MM'));
    }
    return keys;
  }, [months]);

  return {
    monthKeys,
    categories,
  };
}

// Hook for monthly budget suggestions based on history
export function useBudgetSuggestions(month: string) {
  const { healthMetrics, settings } = useBudgetRules({ month });
  
  const prevMonth = format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
  const prevRules = useBudgetRules({ month: prevMonth });

  const autoSuggestions = useMemo(() => {
    const suggestions: Array<{
      categoryId: string;
      categoryName: string;
      currentBudget: number;
      suggestedBudget: number;
      reason: string;
    }> = [];

    prevRules.categoryDetails.forEach(prevCat => {
      if (prevCat.isOverBudget) {
        suggestions.push({
          categoryId: prevCat.categoryId,
          categoryName: prevCat.categoryName,
          currentBudget: prevCat.budget,
          suggestedBudget: Math.round(prevCat.spent * 1.1),
          reason: `You overspent by ₹${Math.round(prevCat.spent - prevCat.budget).toLocaleString()} last month`,
        });
      }
    });

    return suggestions;
  }, [prevRules, healthMetrics]);

  return {
    autoSuggestions,
    healthMetrics,
    settings,
  };
}
