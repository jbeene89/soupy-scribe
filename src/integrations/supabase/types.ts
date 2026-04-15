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
      action_pathways: {
        Row: {
          action_rationale: string
          alternative_actions: Json | null
          case_id: string
          confidence_in_recommendation: number | null
          created_at: string
          id: string
          input_factors: Json
          is_human_review_required: boolean | null
          recommended_action: string
        }
        Insert: {
          action_rationale: string
          alternative_actions?: Json | null
          case_id: string
          confidence_in_recommendation?: number | null
          created_at?: string
          id?: string
          input_factors?: Json
          is_human_review_required?: boolean | null
          recommended_action: string
        }
        Update: {
          action_rationale?: string
          alternative_actions?: Json | null
          case_id?: string
          confidence_in_recommendation?: number | null
          created_at?: string
          id?: string
          input_factors?: Json
          is_human_review_required?: boolean | null
          recommended_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_pathways_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      appeal_outcomes: {
        Row: {
          appeal_strategy: string | null
          case_id: string | null
          cpt_codes: string[] | null
          created_at: string
          denial_type: string | null
          evidence_package: Json | null
          failure_factors: Json | null
          id: string
          notes: string | null
          outcome: string
          payer_code: string | null
          success_factors: Json | null
        }
        Insert: {
          appeal_strategy?: string | null
          case_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string
          denial_type?: string | null
          evidence_package?: Json | null
          failure_factors?: Json | null
          id?: string
          notes?: string | null
          outcome: string
          payer_code?: string | null
          success_factors?: Json | null
        }
        Update: {
          appeal_strategy?: string | null
          case_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string
          denial_type?: string | null
          evidence_package?: Json | null
          failure_factors?: Json | null
          id?: string
          notes?: string | null
          outcome?: string
          payer_code?: string | null
          success_factors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "appeal_outcomes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_cases: {
        Row: {
          assigned_to: string | null
          body_region: string | null
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
          linked_case_id: string | null
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
          body_region?: string | null
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
          linked_case_id?: string | null
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
          body_region?: string | null
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
          linked_case_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "audit_cases_linked_case_id_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
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
      confidence_floor_events: {
        Row: {
          actual_value: number
          case_id: string
          created_at: string
          explanation: string | null
          floor_type: string
          id: string
          routed_to_human: boolean
          threshold_value: number
          uncertainty_drivers: Json
        }
        Insert: {
          actual_value?: number
          case_id: string
          created_at?: string
          explanation?: string | null
          floor_type: string
          id?: string
          routed_to_human?: boolean
          threshold_value?: number
          uncertainty_drivers?: Json
        }
        Update: {
          actual_value?: number
          case_id?: string
          created_at?: string
          explanation?: string | null
          floor_type?: string
          id?: string
          routed_to_human?: boolean
          threshold_value?: number
          uncertainty_drivers?: Json
        }
        Relationships: [
          {
            foreignKeyName: "confidence_floor_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      contradictions: {
        Row: {
          case_id: string
          contradiction_type: string
          created_at: string
          description: string
          explanation: string | null
          id: string
          severity: string
          source_a: string | null
          source_b: string | null
        }
        Insert: {
          case_id: string
          contradiction_type: string
          created_at?: string
          description: string
          explanation?: string | null
          id?: string
          severity?: string
          source_a?: string | null
          source_b?: string | null
        }
        Update: {
          case_id?: string
          contradiction_type?: string
          created_at?: string
          description?: string
          explanation?: string | null
          id?: string
          severity?: string
          source_a?: string | null
          source_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contradictions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_traces: {
        Row: {
          case_id: string
          confidence_at_completion: number | null
          consensus_integrity_grade: string | null
          created_at: string
          final_recommendation: string | null
          id: string
          recommendation_rationale: string | null
          trace_entries: Json
        }
        Insert: {
          case_id: string
          confidence_at_completion?: number | null
          consensus_integrity_grade?: string | null
          created_at?: string
          final_recommendation?: string | null
          id?: string
          recommendation_rationale?: string | null
          trace_entries?: Json
        }
        Update: {
          case_id?: string
          confidence_at_completion?: number | null
          consensus_integrity_grade?: string | null
          created_at?: string
          final_recommendation?: string | null
          id?: string
          recommendation_rationale?: string | null
          trace_entries?: Json
        }
        Relationships: [
          {
            foreignKeyName: "decision_traces_case_id_fkey"
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
      evidence_sufficiency: {
        Row: {
          case_id: string
          created_at: string
          id: string
          is_defensible: boolean | null
          is_under_supported: boolean | null
          missing_evidence: Json
          overall_score: number
          source_weights_applied: Json | null
          sufficiency_for_appeal_defense: number | null
          sufficiency_for_appeal_not_recommended: number | null
          sufficiency_for_approve: number | null
          sufficiency_for_deny: number | null
          sufficiency_for_info_request: number | null
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          is_defensible?: boolean | null
          is_under_supported?: boolean | null
          missing_evidence?: Json
          overall_score?: number
          source_weights_applied?: Json | null
          sufficiency_for_appeal_defense?: number | null
          sufficiency_for_appeal_not_recommended?: number | null
          sufficiency_for_approve?: number | null
          sufficiency_for_deny?: number | null
          sufficiency_for_info_request?: number | null
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          is_defensible?: boolean | null
          is_under_supported?: boolean | null
          missing_evidence?: Json
          overall_score?: number
          source_weights_applied?: Json | null
          sufficiency_for_appeal_defense?: number | null
          sufficiency_for_appeal_not_recommended?: number | null
          sufficiency_for_approve?: number | null
          sufficiency_for_deny?: number | null
          sufficiency_for_info_request?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_sufficiency_case_id_fkey"
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
      gold_set_cases: {
        Row: {
          accuracy_rate: number | null
          case_label: string
          case_template: Json
          category: string
          created_at: string
          id: string
          is_locked: boolean
          known_outcome: Json
          last_replayed_at: string | null
          total_correct: number | null
          total_replays: number | null
        }
        Insert: {
          accuracy_rate?: number | null
          case_label: string
          case_template: Json
          category?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          known_outcome: Json
          last_replayed_at?: string | null
          total_correct?: number | null
          total_replays?: number | null
        }
        Update: {
          accuracy_rate?: number | null
          case_label?: string
          case_template?: Json
          category?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          known_outcome?: Json
          last_replayed_at?: string | null
          total_correct?: number | null
          total_replays?: number | null
        }
        Relationships: []
      }
      minimal_winning_packets: {
        Row: {
          case_id: string
          checklist: Json
          created_at: string
          estimated_curable_count: number | null
          estimated_not_worth_chasing: number | null
          id: string
          top_priority_item: string | null
        }
        Insert: {
          case_id: string
          checklist?: Json
          created_at?: string
          estimated_curable_count?: number | null
          estimated_not_worth_chasing?: number | null
          id?: string
          top_priority_item?: string | null
        }
        Update: {
          case_id?: string
          checklist?: Json
          created_at?: string
          estimated_curable_count?: number | null
          estimated_not_worth_chasing?: number | null
          id?: string
          top_priority_item?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "minimal_winning_packets_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      or_readiness_events: {
        Row: {
          case_id: string | null
          classification: string
          created_at: string
          delay_minutes: number | null
          event_type: string
          id: string
          notes: string | null
          org_id: string | null
          patient_wait_status: string | null
          replacement_source: string | null
          room_id: string | null
          service_line: string | null
          shift: string | null
          vendor_rep: string | null
        }
        Insert: {
          case_id?: string | null
          classification?: string
          created_at?: string
          delay_minutes?: number | null
          event_type?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          patient_wait_status?: string | null
          replacement_source?: string | null
          room_id?: string | null
          service_line?: string | null
          shift?: string | null
          vendor_rep?: string | null
        }
        Update: {
          case_id?: string | null
          classification?: string
          created_at?: string
          delay_minutes?: number | null
          event_type?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          patient_wait_status?: string | null
          replacement_source?: string | null
          room_id?: string | null
          service_line?: string | null
          shift?: string | null
          vendor_rep?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "or_readiness_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "or_readiness_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
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
      postop_flow_events: {
        Row: {
          bed_available: boolean | null
          case_id: string | null
          created_at: string
          day_of_week: string | null
          delay_reason: string | null
          facility: string | null
          id: string
          notes: string | null
          org_id: string | null
          patient_wait_minutes: number | null
          service_line: string | null
          shift: string | null
          staff_idle_minutes: number | null
          surgeon_name: string | null
        }
        Insert: {
          bed_available?: boolean | null
          case_id?: string | null
          created_at?: string
          day_of_week?: string | null
          delay_reason?: string | null
          facility?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          patient_wait_minutes?: number | null
          service_line?: string | null
          shift?: string | null
          staff_idle_minutes?: number | null
          surgeon_name?: string | null
        }
        Update: {
          bed_available?: boolean | null
          case_id?: string | null
          created_at?: string
          day_of_week?: string | null
          delay_reason?: string | null
          facility?: string | null
          id?: string
          notes?: string | null
          org_id?: string | null
          patient_wait_minutes?: number | null
          service_line?: string | null
          shift?: string | null
          staff_idle_minutes?: number | null
          surgeon_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postop_flow_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postop_flow_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      regulatory_flags: {
        Row: {
          case_id: string | null
          created_at: string
          description: string
          effective_date: string | null
          flag_type: string
          id: string
          is_active: boolean
          severity: string
          source_reference: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          description: string
          effective_date?: string | null
          flag_type: string
          id?: string
          is_active?: boolean
          severity?: string
          source_reference?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          description?: string
          effective_date?: string | null
          flag_type?: string
          id?: string
          is_active?: boolean
          severity?: string
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_flags_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      source_weights: {
        Row: {
          base_weight: number
          created_at: string
          description: string | null
          id: string
          is_primary_clinical: boolean
          recency_decay_days: number | null
          source_type: string
          updated_at: string
        }
        Insert: {
          base_weight?: number
          created_at?: string
          description?: string | null
          id?: string
          is_primary_clinical?: boolean
          recency_decay_days?: number | null
          source_type: string
          updated_at?: string
        }
        Update: {
          base_weight?: number
          created_at?: string
          description?: string | null
          id?: string
          is_primary_clinical?: boolean
          recency_decay_days?: number | null
          source_type?: string
          updated_at?: string
        }
        Relationships: []
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
      triage_accuracy_events: {
        Row: {
          actual_duration: number | null
          actual_implant: string | null
          actual_procedure: string | null
          booker_name: string | null
          case_id: string | null
          complexity_delta: number | null
          created_at: string
          expected_duration: number | null
          expected_implant: string | null
          expected_procedure: string | null
          extra_equipment: string[] | null
          foreseeability_class: string | null
          foreseeability_score: number | null
          id: string
          notes: string | null
          org_id: string | null
          service_line: string | null
          surgeon_name: string | null
          unplanned_support: string[] | null
        }
        Insert: {
          actual_duration?: number | null
          actual_implant?: string | null
          actual_procedure?: string | null
          booker_name?: string | null
          case_id?: string | null
          complexity_delta?: number | null
          created_at?: string
          expected_duration?: number | null
          expected_implant?: string | null
          expected_procedure?: string | null
          extra_equipment?: string[] | null
          foreseeability_class?: string | null
          foreseeability_score?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          service_line?: string | null
          surgeon_name?: string | null
          unplanned_support?: string[] | null
        }
        Update: {
          actual_duration?: number | null
          actual_implant?: string | null
          actual_procedure?: string | null
          booker_name?: string | null
          case_id?: string | null
          complexity_delta?: number | null
          created_at?: string
          expected_duration?: number | null
          expected_implant?: string | null
          expected_procedure?: string | null
          extra_equipment?: string[] | null
          foreseeability_class?: string | null
          foreseeability_score?: number | null
          id?: string
          notes?: string | null
          org_id?: string | null
          service_line?: string | null
          surgeon_name?: string | null
          unplanned_support?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "triage_accuracy_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "audit_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triage_accuracy_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_org_ids: { Args: { _user_id: string }; Returns: string[] }
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
