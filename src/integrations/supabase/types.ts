export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          budget_alert_threshold: number
          category_type: string | null
          color: string
          created_at: string
          icon: string
          id: string
          monthly_budget: number | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_alert_threshold?: number
          category_type?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          monthly_budget?: number | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_alert_threshold?: number
          category_type?: string | null
          color?: string
          created_at?: string
          icon?: string
          id?: string
          monthly_budget?: number | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      category_budgets: {
        Row: {
          budget_amount: number
          category_id: string
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_amount?: number
          category_id: string
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_mappings: {
        Row: {
          category_id: string
          created_at: string
          id: string
          keyword: string
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          keyword: string
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          keyword?: string
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_drafts: {
        Row: {
          amount: number | null
          category_id: string | null
          date: string | null
          id: string
          note: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          category_id?: string | null
          date?: string | null
          id?: string
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          category_id?: string | null
          date?: string | null
          id?: string
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_drafts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          date: string
          id: string
          is_draft: boolean
          note: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_draft?: boolean
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_draft?: boolean
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_transactions: {
        Row: {
          ai_confidence: number | null
          amount: number
          balance: number | null
          created_at: string
          description: string
          duplicate_of: string | null
          id: string
          import_id: string
          is_duplicate: boolean | null
          is_selected: boolean | null
          raw_text: string | null
          suggested_category_id: string | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          amount: number
          balance?: number | null
          created_at?: string
          description: string
          duplicate_of?: string | null
          id?: string
          import_id: string
          is_duplicate?: boolean | null
          is_selected?: boolean | null
          raw_text?: string | null
          suggested_category_id?: string | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          amount?: number
          balance?: number | null
          created_at?: string
          description?: string
          duplicate_of?: string | null
          id?: string
          import_id?: string
          is_duplicate?: boolean | null
          is_selected?: boolean | null
          raw_text?: string | null
          suggested_category_id?: string | null
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_transactions_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_transactions_suggested_category_id_fkey"
            columns: ["suggested_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      statement_imports: {
        Row: {
          bank_name: string | null
          created_at: string
          error_message: string | null
          expires_at: string
          file_hash: string
          file_name: string
          file_path: string
          id: string
          imported_transactions: number | null
          statement_period_end: string | null
          statement_period_start: string | null
          status: string
          total_transactions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          file_hash: string
          file_name: string
          file_path: string
          id?: string
          imported_transactions?: number | null
          statement_period_end?: string | null
          statement_period_start?: string | null
          status?: string
          total_transactions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          file_hash?: string
          file_name?: string
          file_path?: string
          id?: string
          imported_transactions?: number | null
          statement_period_end?: string | null
          statement_period_start?: string | null
          status?: string
          total_transactions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_financial_settings: {
        Row: {
          budget_mode: string | null
          created_at: string
          id: string
          min_savings_target: number | null
          monthly_income: number | null
          needs_percentage: number | null
          savings_percentage: number | null
          show_budget_suggestions: boolean | null
          smart_rules_enabled: boolean | null
          updated_at: string
          user_id: string
          wants_percentage: number | null
        }
        Insert: {
          budget_mode?: string | null
          created_at?: string
          id?: string
          min_savings_target?: number | null
          monthly_income?: number | null
          needs_percentage?: number | null
          savings_percentage?: number | null
          show_budget_suggestions?: boolean | null
          smart_rules_enabled?: boolean | null
          updated_at?: string
          user_id: string
          wants_percentage?: number | null
        }
        Update: {
          budget_mode?: string | null
          created_at?: string
          id?: string
          min_savings_target?: number | null
          monthly_income?: number | null
          needs_percentage?: number | null
          savings_percentage?: number | null
          show_budget_suggestions?: boolean | null
          smart_rules_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          wants_percentage?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_imports: { Args: never; Returns: undefined }
      get_effective_budget: {
        Args: { p_category_id: string; p_month: string; p_user_id: string }
        Returns: number
      }
      increment_mapping_count: {
        Args: { p_keyword: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      payment_method: "cash" | "upi" | "card" | "bank" | "wallet"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_method: ["cash", "upi", "card", "bank", "wallet"],
    },
  },
} as const
