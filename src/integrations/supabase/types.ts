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
    PostgrestVersion: "14.4"
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
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
      case_graph_edges: {
        Row: {
          created_at: string
          id: string
          insights: Json | null
          relationship_type: string
          shared_attributes: Json | null
          source_case_id: string
          strength: number | null
          target_case_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights?: Json | null
          relationship_type: string
          shared_attributes?: Json | null
          source_case_id: string
          strength?: number | null
          target_case_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: Json | null
          relationship_type?: string
          shared_attributes?: Json | null
          source_case_id?: string
          strength?: number | null
          target_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_graph_edges_source_case_id_fkey"
            columns: ["source_case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_graph_edges_target_case_id_fkey"
            columns: ["target_case_id"]
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
      devils_advocate_results: {
        Row: {
          attack_vectors: Json | null
          case_id: string
          consensus_after: number | null
          consensus_before: number | null
          consensus_survived: boolean | null
          created_at: string
          id: string
          reanalysis_triggered: boolean | null
          vulnerabilities_found: Json | null
        }
        Insert: {
          attack_vectors?: Json | null
          case_id: string
          consensus_after?: number | null
          consensus_before?: number | null
          consensus_survived?: boolean | null
          created_at?: string
          id?: string
          reanalysis_triggered?: boolean | null
          vulnerabilities_found?: Json | null
        }
        Update: {
          attack_vectors?: Json | null
          case_id?: string
          consensus_after?: number | null
          consensus_before?: number | null
          consensus_survived?: boolean | null
          created_at?: string
          id?: string
          reanalysis_triggered?: boolean | null
          vulnerabilities_found?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "devils_advocate_results_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      engine_calibration: {
        Row: {
          actual_outcome: string | null
          calibration_notes: string | null
          case_id: string
          created_at: string
          deviation_score: number | null
          id: string
          predicted_confidence: number
          predicted_outcome: string
          resolved_at: string | null
          role_weights: Json | null
        }
        Insert: {
          actual_outcome?: string | null
          calibration_notes?: string | null
          case_id: string
          created_at?: string
          deviation_score?: number | null
          id?: string
          predicted_confidence?: number
          predicted_outcome: string
          resolved_at?: string | null
          role_weights?: Json | null
        }
        Update: {
          actual_outcome?: string | null
          calibration_notes?: string | null
          case_id?: string
          created_at?: string
          deviation_score?: number | null
          id?: string
          predicted_confidence?: number
          predicted_outcome?: string
          resolved_at?: string | null
          role_weights?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_calibration_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ghost_case_results: {
        Row: {
          accuracy_score: number | null
          case_id: string | null
          created_at: string
          deviation_details: Json | null
          engine_output: Json
          expected_output: Json
          ghost_case_id: string
          id: string
        }
        Insert: {
          accuracy_score?: number | null
          case_id?: string | null
          created_at?: string
          deviation_details?: Json | null
          engine_output?: Json
          expected_output?: Json
          ghost_case_id: string
          id?: string
        }
        Update: {
          accuracy_score?: number | null
          case_id?: string | null
          created_at?: string
          deviation_details?: Json | null
          engine_output?: Json
          expected_output?: Json
          ghost_case_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghost_case_results_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghost_case_results_ghost_case_id_fkey"
            columns: ["ghost_case_id"]
            isOneToOne: false
            referencedRelation: "ghost_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ghost_cases: {
        Row: {
          accuracy_rate: number | null
          case_template: Json
          category: string
          created_at: string
          difficulty: string
          id: string
          known_answer: Json
          last_injected_at: string | null
          times_correct: number | null
          times_tested: number | null
          updated_at: string
        }
        Insert: {
          accuracy_rate?: number | null
          case_template: Json
          category?: string
          created_at?: string
          difficulty?: string
          id?: string
          known_answer: Json
          last_injected_at?: string | null
          times_correct?: number | null
          times_tested?: number | null
          updated_at?: string
        }
        Update: {
          accuracy_rate?: number | null
          case_template?: Json
          category?: string
          created_at?: string
          difficulty?: string
          id?: string
          known_answer?: Json
          last_injected_at?: string | null
          times_correct?: number | null
          times_tested?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      payer_profiles: {
        Row: {
          adversarial_prompt_additions: string | null
          appeal_success_rates: Json | null
          behavioral_notes: string | null
          code_combination_flags: Json | null
          created_at: string
          denial_patterns: Json | null
          id: string
          last_updated: string
          modifier_sensitivity: Json | null
          payer_code: string | null
          payer_name: string
        }
        Insert: {
          adversarial_prompt_additions?: string | null
          appeal_success_rates?: Json | null
          behavioral_notes?: string | null
          code_combination_flags?: Json | null
          created_at?: string
          denial_patterns?: Json | null
          id?: string
          last_updated?: string
          modifier_sensitivity?: Json | null
          payer_code?: string | null
          payer_name: string
        }
        Update: {
          adversarial_prompt_additions?: string | null
          appeal_success_rates?: Json | null
          behavioral_notes?: string | null
          code_combination_flags?: Json | null
          created_at?: string
          denial_patterns?: Json | null
          id?: string
          last_updated?: string
          modifier_sensitivity?: Json | null
          payer_code?: string | null
          payer_name?: string
        }
        Relationships: []
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
      reasoning_chains: {
        Row: {
          analysis_id: string | null
          case_id: string
          created_at: string
          id: string
          latency_ms: number | null
          model: string
          raw_reasoning: string | null
          role: string
          structured_steps: Json | null
          token_count: number | null
        }
        Insert: {
          analysis_id?: string | null
          case_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model: string
          raw_reasoning?: string | null
          role: string
          structured_steps?: Json | null
          token_count?: number | null
        }
        Update: {
          analysis_id?: string | null
          case_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          model?: string
          raw_reasoning?: string | null
          role?: string
          structured_steps?: Json | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reasoning_chains_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "case_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reasoning_chains_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      stability_checks: {
        Row: {
          case_id: string
          created_at: string
          drift_score: number | null
          id: string
          is_stable: boolean | null
          prompt_order_a: string[] | null
          prompt_order_b: string[] | null
          run_a_output: Json
          run_b_output: Json
          unstable_roles: string[] | null
        }
        Insert: {
          case_id: string
          created_at?: string
          drift_score?: number | null
          id?: string
          is_stable?: boolean | null
          prompt_order_a?: string[] | null
          prompt_order_b?: string[] | null
          run_a_output?: Json
          run_b_output?: Json
          unstable_roles?: string[] | null
        }
        Update: {
          case_id?: string
          created_at?: string
          drift_score?: number | null
          id?: string
          is_stable?: boolean | null
          prompt_order_a?: string[] | null
          prompt_order_b?: string[] | null
          run_a_output?: Json
          run_b_output?: Json
          unstable_roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "stability_checks_case_id_fkey"
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
