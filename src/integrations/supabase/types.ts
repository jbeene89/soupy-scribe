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
      audit_cases: {
        Row: {
          assigned_to: string | null
          case_number: string
          claim_amount: number
          consensus_score: number | null
          cpt_codes: string[]
          created_at: string
          date_of_service: string
          date_submitted: string
          decision: Json | null
          icd_codes: string[]
          id: string
          metadata: Json | null
          patient_id: string
          physician_id: string
          physician_name: string
          risk_score: Json | null
          source_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_number: string
          claim_amount?: number
          consensus_score?: number | null
          cpt_codes?: string[]
          created_at?: string
          date_of_service: string
          date_submitted?: string
          decision?: Json | null
          icd_codes?: string[]
          id?: string
          metadata?: Json | null
          patient_id: string
          physician_id: string
          physician_name: string
          risk_score?: Json | null
          source_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_number?: string
          claim_amount?: number
          consensus_score?: number | null
          cpt_codes?: string[]
          created_at?: string
          date_of_service?: string
          date_submitted?: string
          decision?: Json | null
          icd_codes?: string[]
          id?: string
          metadata?: Json | null
          patient_id?: string
          physician_id?: string
          physician_name?: string
          risk_score?: Json | null
          source_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      case_analyses: {
        Row: {
          assumptions: string[] | null
          case_id: string
          confidence: number | null
          created_at: string
          id: string
          key_insights: string[] | null
          model: string
          overall_assessment: string | null
          perspective_statement: string | null
          role: string
          status: string
          updated_at: string
          violations: Json | null
        }
        Insert: {
          assumptions?: string[] | null
          case_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          key_insights?: string[] | null
          model: string
          overall_assessment?: string | null
          perspective_statement?: string | null
          role: string
          status?: string
          updated_at?: string
          violations?: Json | null
        }
        Update: {
          assumptions?: string[] | null
          case_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          key_insights?: string[] | null
          model?: string
          overall_assessment?: string | null
          perspective_statement?: string | null
          role?: string
          status?: string
          updated_at?: string
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "case_analyses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_files: {
        Row: {
          case_id: string | null
          created_at: string
          extracted_text: string | null
          extraction_status: string
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          storage_path: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          file_name: string
          file_size?: number | null
          file_type: string
          id?: string
          storage_path?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          extracted_text?: string | null
          extraction_status?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      code_combinations: {
        Row: {
          case_id: string | null
          codes: string[]
          created_at: string
          flag_reason: string
          id: string
          legitimate_explanations: string[] | null
          noncompliant_explanations: string[] | null
          required_documentation: string[] | null
        }
        Insert: {
          case_id?: string | null
          codes: string[]
          created_at?: string
          flag_reason: string
          id?: string
          legitimate_explanations?: string[] | null
          noncompliant_explanations?: string[] | null
          required_documentation?: string[] | null
        }
        Update: {
          case_id?: string | null
          codes?: string[]
          created_at?: string
          flag_reason?: string
          id?: string
          legitimate_explanations?: string[] | null
          noncompliant_explanations?: string[] | null
          required_documentation?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "code_combinations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_queue: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          progress: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          progress?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          progress?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
