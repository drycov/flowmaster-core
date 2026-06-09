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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      app_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          correlation_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          ip: string | null
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: number
          ip?: string | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: number
          ip?: string | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_challenges: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          nonce: string
          purpose: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          nonce: string
          purpose: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          purpose?: string
          used_at?: string | null
        }
        Relationships: []
      }
      business_calendar_days: {
        Row: {
          day_date: string
          is_holiday: boolean
          name_kk: string
          name_ru: string
        }
        Insert: {
          day_date: string
          is_holiday?: boolean
          name_kk?: string
          name_ru?: string
        }
        Update: {
          day_date?: string
          is_holiday?: boolean
          name_kk?: string
          name_ru?: string
        }
        Relationships: []
      }
      contract_details: {
        Row: {
          amount: number | null
          auto_renew: boolean
          contract_date: string | null
          contract_number: string
          contract_status: string
          counterparty_id: string | null
          created_at: string
          currency: string
          document_id: string
          payment_terms: string
          subject_kk: string
          subject_ru: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          amount?: number | null
          auto_renew?: boolean
          contract_date?: string | null
          contract_number?: string
          contract_status?: string
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          document_id: string
          payment_terms?: string
          subject_kk?: string
          subject_ru?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          amount?: number | null
          auto_renew?: boolean
          contract_date?: string | null
          contract_number?: string
          contract_status?: string
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          document_id?: string
          payment_terms?: string
          subject_kk?: string
          subject_ru?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_details_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "ref_correspondents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_details_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          deputy_user_ids: string[]
          email: string | null
          head_user_id: string | null
          id: string
          is_active: boolean
          kind: string
          name_kk: string
          name_ru: string
          organization_id: string | null
          parent_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deputy_user_ids?: string[]
          email?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name_kk: string
          name_ru: string
          organization_id?: string | null
          parent_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deputy_user_ids?: string[]
          email?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name_kk?: string
          name_ru?: string
          organization_id?: string | null
          parent_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_grants: {
        Row: {
          created_at: string
          document_id: string
          expires_at: string | null
          id: string
          reason: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          expires_at?: string | null
          id?: string
          reason?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          expires_at?: string | null
          id?: string
          reason?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_grants_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          document_id: string
          id: string
          parent_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          document_id: string
          id?: string
          parent_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          document_id?: string
          id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_correspondents: {
        Row: {
          correspondent_id: string
          created_at: string
          document_id: string
          id: string
          is_primary: boolean
          role: string
        }
        Insert: {
          correspondent_id: string
          created_at?: string
          document_id: string
          id?: string
          is_primary?: boolean
          role?: string
        }
        Update: {
          correspondent_id?: string
          created_at?: string
          document_id?: string
          id?: string
          is_primary?: boolean
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_correspondents_correspondent_id_fkey"
            columns: ["correspondent_id"]
            isOneToOne: false
            referencedRelation: "ref_correspondents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_correspondents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          link_type_id: string
          note: string | null
          source_document_id: string
          target_document_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          link_type_id: string
          note?: string | null
          source_document_id: string
          target_document_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          link_type_id?: string
          note?: string | null
          source_document_id?: string
          target_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_link_type_id_fkey"
            columns: ["link_type_id"]
            isOneToOne: false
            referencedRelation: "ref_document_link_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_target_document_id_fkey"
            columns: ["target_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_project_templates: {
        Row: {
          created_at: string
          default_workflow_id: string | null
          id: string
          is_required: boolean
          label_kk: string
          label_ru: string
          project_id: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          default_workflow_id?: string | null
          id?: string
          is_required?: boolean
          label_kk?: string
          label_ru?: string
          project_id: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          default_workflow_id?: string | null
          id?: string
          is_required?: boolean
          label_kk?: string
          label_ru?: string
          project_id?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_project_templates_default_workflow_id_fkey"
            columns: ["default_workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_project_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "document_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_project_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_projects: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          description_kk: string
          description_ru: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          nomenclature_id: string | null
          organization_id: string | null
          owner_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          description_kk?: string
          description_ru?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          nomenclature_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          description_kk?: string
          description_ru?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          nomenclature_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_projects_nomenclature_id_fkey"
            columns: ["nomenclature_id"]
            isOneToOne: false
            referencedRelation: "nomenclature_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          cert_fingerprint: string | null
          cert_issuer: string | null
          cert_serial: string | null
          cert_subject: string | null
          cert_valid_from: string | null
          cert_valid_to: string | null
          content_hash: string | null
          created_at: string
          document_id: string
          id: string
          payload: string | null
          signature_type: string
          signed_at: string | null
          signer_bin: string | null
          signer_id: string
          signer_iin: string | null
          status: Database["public"]["Enums"]["signature_status"]
          verification_details: Json
          verification_status: string
          verified_at: string | null
          version_id: string | null
        }
        Insert: {
          cert_fingerprint?: string | null
          cert_issuer?: string | null
          cert_serial?: string | null
          cert_subject?: string | null
          cert_valid_from?: string | null
          cert_valid_to?: string | null
          content_hash?: string | null
          created_at?: string
          document_id: string
          id?: string
          payload?: string | null
          signature_type?: string
          signed_at?: string | null
          signer_bin?: string | null
          signer_id: string
          signer_iin?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          verification_details?: Json
          verification_status?: string
          verified_at?: string | null
          version_id?: string | null
        }
        Update: {
          cert_fingerprint?: string | null
          cert_issuer?: string | null
          cert_serial?: string | null
          cert_subject?: string | null
          cert_valid_from?: string | null
          cert_valid_to?: string | null
          content_hash?: string | null
          created_at?: string
          document_id?: string
          id?: string
          payload?: string | null
          signature_type?: string
          signed_at?: string | null
          signer_bin?: string | null
          signer_id?: string
          signer_iin?: string | null
          status?: Database["public"]["Enums"]["signature_status"]
          verification_details?: Json
          verification_status?: string
          verified_at?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          allow_custom_route: boolean
          category: string
          created_at: string
          created_by: string | null
          default_workflow_id: string | null
          description: string | null
          file_format: string
          file_path: string | null
          id: string
          name_kk: string
          name_ru: string
          organization_id: string | null
          schema: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          allow_custom_route?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          default_workflow_id?: string | null
          description?: string | null
          file_format?: string
          file_path?: string | null
          id?: string
          name_kk: string
          name_ru: string
          organization_id?: string | null
          schema?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          allow_custom_route?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          default_workflow_id?: string | null
          description?: string | null
          file_format?: string
          file_path?: string | null
          id?: string
          name_kk?: string
          name_ru?: string
          organization_id?: string | null
          schema?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_default_workflow_id_fkey"
            columns: ["default_workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          body_snapshot: string | null
          comment: string | null
          content_hash: string | null
          created_at: string
          created_by: string
          document_id: string
          file_format: string | null
          file_path: string | null
          id: string
          is_locked: boolean
          version_no: number
        }
        Insert: {
          body_snapshot?: string | null
          comment?: string | null
          content_hash?: string | null
          created_at?: string
          created_by: string
          document_id: string
          file_format?: string | null
          file_path?: string | null
          id?: string
          is_locked?: boolean
          version_no: number
        }
        Update: {
          body_snapshot?: string | null
          comment?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          file_format?: string | null
          file_path?: string | null
          id?: string
          is_locked?: boolean
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          access_level_id: string | null
          archive_location_id: string | null
          archived_at: string | null
          assigned_to: string | null
          body: string | null
          copies_count: number | null
          correspondent_id: string | null
          created_at: string
          created_by: string
          current_version: number
          custom_route: Json | null
          delivery_method_id: string | null
          department_id: string | null
          doc_type: string
          document_type_id: string | null
          due_at: string | null
          external_reg_number: string | null
          id: string
          legal_hold: boolean
          legal_hold_at: string | null
          legal_hold_by: string | null
          legal_hold_note: string | null
          nomenclature_id: string | null
          organization_id: string | null
          pages_count: number | null
          priority_id: string | null
          project_id: string | null
          received_at: string | null
          reg_number: string
          registration_journal_id: string | null
          retention_due_at: string | null
          retention_period_id: string | null
          search_tsv: unknown
          sent_at: string | null
          sla_status: Database["public"]["Enums"]["sla_status"]
          status: Database["public"]["Enums"]["document_status"]
          summary: string | null
          template_id: string | null
          title_kk: string | null
          title_ru: string
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          access_level_id?: string | null
          archive_location_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          body?: string | null
          copies_count?: number | null
          correspondent_id?: string | null
          created_at?: string
          created_by: string
          current_version?: number
          custom_route?: Json | null
          delivery_method_id?: string | null
          department_id?: string | null
          doc_type?: string
          document_type_id?: string | null
          due_at?: string | null
          external_reg_number?: string | null
          id?: string
          legal_hold?: boolean
          legal_hold_at?: string | null
          legal_hold_by?: string | null
          legal_hold_note?: string | null
          nomenclature_id?: string | null
          organization_id?: string | null
          pages_count?: number | null
          priority_id?: string | null
          project_id?: string | null
          received_at?: string | null
          reg_number: string
          registration_journal_id?: string | null
          retention_due_at?: string | null
          retention_period_id?: string | null
          search_tsv?: unknown
          sent_at?: string | null
          sla_status?: Database["public"]["Enums"]["sla_status"]
          status?: Database["public"]["Enums"]["document_status"]
          summary?: string | null
          template_id?: string | null
          title_kk?: string | null
          title_ru: string
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          access_level_id?: string | null
          archive_location_id?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          body?: string | null
          copies_count?: number | null
          correspondent_id?: string | null
          created_at?: string
          created_by?: string
          current_version?: number
          custom_route?: Json | null
          delivery_method_id?: string | null
          department_id?: string | null
          doc_type?: string
          document_type_id?: string | null
          due_at?: string | null
          external_reg_number?: string | null
          id?: string
          legal_hold?: boolean
          legal_hold_at?: string | null
          legal_hold_by?: string | null
          legal_hold_note?: string | null
          nomenclature_id?: string | null
          organization_id?: string | null
          pages_count?: number | null
          priority_id?: string | null
          project_id?: string | null
          received_at?: string | null
          reg_number?: string
          registration_journal_id?: string | null
          retention_due_at?: string | null
          retention_period_id?: string | null
          search_tsv?: unknown
          sent_at?: string | null
          sla_status?: Database["public"]["Enums"]["sla_status"]
          status?: Database["public"]["Enums"]["document_status"]
          summary?: string | null
          template_id?: string | null
          title_kk?: string | null
          title_ru?: string
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_access_level_id_fkey"
            columns: ["access_level_id"]
            isOneToOne: false
            referencedRelation: "ref_access_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_archive_location_id_fkey"
            columns: ["archive_location_id"]
            isOneToOne: false
            referencedRelation: "ref_archive_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_correspondent_id_fkey"
            columns: ["correspondent_id"]
            isOneToOne: false
            referencedRelation: "ref_correspondents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_delivery_method_id_fkey"
            columns: ["delivery_method_id"]
            isOneToOne: false
            referencedRelation: "ref_delivery_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "ref_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_nomenclature_id_fkey"
            columns: ["nomenclature_id"]
            isOneToOne: false
            referencedRelation: "nomenclature_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "ref_priorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "document_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_registration_journal_id_fkey"
            columns: ["registration_journal_id"]
            isOneToOne: false
            referencedRelation: "ref_registration_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_retention_period_id_fkey"
            columns: ["retention_period_id"]
            isOneToOne: false
            referencedRelation: "ref_retention_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_assignments: {
        Row: {
          assignee_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          duty_role_id: string
          ends_at: string
          id: string
          note: string
          starts_at: string
          status: string
          substitute_id: string | null
          updated_at: string
        }
        Insert: {
          assignee_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          duty_role_id: string
          ends_at: string
          id?: string
          note?: string
          starts_at: string
          status?: string
          substitute_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          duty_role_id?: string
          ends_at?: string
          id?: string
          note?: string
          starts_at?: string
          status?: string
          substitute_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_assignments_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_duty_role_id_fkey"
            columns: ["duty_role_id"]
            isOneToOne: false
            referencedRelation: "ref_duty_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_assignments_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_reminder_log: {
        Row: {
          created_at: string
          duty_assignment_id: string
          reminded_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duty_assignment_id: string
          reminded_on?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duty_assignment_id?: string
          reminded_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duty_reminder_log_duty_assignment_id_fkey"
            columns: ["duty_assignment_id"]
            isOneToOne: false
            referencedRelation: "duty_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_reminder_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          app_link: string | null
          attempts: number
          body_html: string | null
          body_text: string | null
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          next_retry_at: string
          notification_id: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          app_link?: string | null
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          notification_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          app_link?: string | null
          attempts?: number
          body_html?: string | null
          body_text?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          notification_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          api_key_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number
          errors: Json
          id: string
          kind: string
          source: string
          started_at: string | null
          status: string
          success_count: number
          total_count: number
        }
        Insert: {
          api_key_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          errors?: Json
          id?: string
          kind?: string
          source?: string
          started_at?: string | null
          status?: string
          success_count?: number
          total_count?: number
        }
        Update: {
          api_key_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          errors?: Json
          id?: string
          kind?: string
          source?: string
          started_at?: string | null
          status?: string
          success_count?: number
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_license: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_mode: string
          created_at: string
          customer_name: string
          expires_at: string | null
          features: Json
          grace_days: number
          id: string
          installation_id: string | null
          issued_at: string | null
          last_sync_at: string | null
          last_sync_error: string
          last_sync_ok: boolean
          license_key_hash: string | null
          license_key_id: string | null
          license_server_token: string | null
          max_users: number
          notes: string
          offline_grace_hours: number
          plan: string
          server_revoked: boolean
          status: string
          sync_interval_hours: number
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_mode?: string
          created_at?: string
          customer_name?: string
          expires_at?: string | null
          features?: Json
          grace_days?: number
          id?: string
          installation_id?: string | null
          issued_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string
          last_sync_ok?: boolean
          license_key_hash?: string | null
          license_key_id?: string | null
          license_server_token?: string | null
          max_users?: number
          notes?: string
          offline_grace_hours?: number
          plan?: string
          server_revoked?: boolean
          status?: string
          sync_interval_hours?: number
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_mode?: string
          created_at?: string
          customer_name?: string
          expires_at?: string | null
          features?: Json
          grace_days?: number
          id?: string
          installation_id?: string | null
          issued_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string
          last_sync_ok?: boolean
          license_key_hash?: string | null
          license_key_id?: string | null
          license_server_token?: string | null
          max_users?: number
          notes?: string
          offline_grace_hours?: number
          plan?: string
          server_revoked?: boolean
          status?: string
          sync_interval_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_license_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          access_level_id: string | null
          author_id: string | null
          body_kk: string
          body_ru: string
          category_id: string | null
          created_at: string
          id: string
          organization_id: string | null
          published_at: string | null
          search_tsv: unknown
          slug: string
          source_document_id: string | null
          status: string
          summary_kk: string
          summary_ru: string
          tags: string[]
          title_kk: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          access_level_id?: string | null
          author_id?: string | null
          body_kk?: string
          body_ru?: string
          category_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          published_at?: string | null
          search_tsv?: unknown
          slug: string
          source_document_id?: string | null
          status?: string
          summary_kk?: string
          summary_ru?: string
          tags?: string[]
          title_kk: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          access_level_id?: string | null
          author_id?: string | null
          body_kk?: string
          body_ru?: string
          category_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          published_at?: string | null
          search_tsv?: unknown
          slug?: string
          source_document_id?: string | null
          status?: string
          summary_kk?: string
          summary_ru?: string
          tags?: string[]
          title_kk?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_access_level_id_fkey"
            columns: ["access_level_id"]
            isOneToOne: false
            referencedRelation: "ref_access_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          organization_id: string | null
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          organization_id?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          organization_id?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          entitled_days: number
          id: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          entitled_days?: number
          id?: string
          used_days?: number
          user_id: string
          year: number
        }
        Update: {
          entitled_days?: number
          id?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          absence_type_id: string
          approver_id: string | null
          business_days: number
          created_at: string
          date_from: string
          date_to: string
          decided_at: string | null
          decision_note: string | null
          document_id: string | null
          id: string
          organization_id: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_type_id: string
          approver_id?: string | null
          business_days?: number
          created_at?: string
          date_from: string
          date_to: string
          decided_at?: string | null
          decision_note?: string | null
          document_id?: string | null
          id?: string
          organization_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_type_id?: string
          approver_id?: string | null
          business_days?: number
          created_at?: string
          date_from?: string
          date_to?: string
          decided_at?: string | null
          decision_note?: string | null
          document_id?: string | null
          id?: string
          organization_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_absence_type_id_fkey"
            columns: ["absence_type_id"]
            isOneToOne: false
            referencedRelation: "ref_absence_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      license_server_activations: {
        Row: {
          activated_at: string
          app_version: string
          hostname: string
          id: string
          installation_id: string
          key_id: string
          last_seen_at: string
          revoked_at: string | null
          revoked_reason: string
          status: string
          token_hash: string
        }
        Insert: {
          activated_at?: string
          app_version?: string
          hostname?: string
          id?: string
          installation_id: string
          key_id: string
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string
          status?: string
          token_hash: string
        }
        Update: {
          activated_at?: string
          app_version?: string
          hostname?: string
          id?: string
          installation_id?: string
          key_id?: string
          last_seen_at?: string
          revoked_at?: string | null
          revoked_reason?: string
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_server_activations_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "license_server_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      license_server_keys: {
        Row: {
          created_at: string
          customer_name: string
          expires_at: string | null
          features: Json
          id: string
          installation_id: string | null
          issued_at: string | null
          key_hash: string
          max_activations: number
          max_users: number
          plan: string
          revoked_at: string | null
          revoked_reason: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string
          expires_at?: string | null
          features?: Json
          id?: string
          installation_id?: string | null
          issued_at?: string | null
          key_hash: string
          max_activations?: number
          max_users: number
          plan: string
          revoked_at?: string | null
          revoked_reason?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          expires_at?: string | null
          features?: Json
          id?: string
          installation_id?: string | null
          issued_at?: string | null
          key_hash?: string
          max_activations?: number
          max_users?: number
          plan?: string
          revoked_at?: string | null
          revoked_reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      nomenclature_items: {
        Row: {
          archive_rule: string
          code: string
          created_at: string
          department_id: string | null
          id: string
          organization_id: string | null
          parent_id: string | null
          retention_years: number
          sort_order: number
          title_kk: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          archive_rule?: string
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          organization_id?: string | null
          parent_id?: string | null
          retention_years?: number
          sort_order?: number
          title_kk: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          archive_rule?: string
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          organization_id?: string | null
          parent_id?: string | null
          retention_years?: number
          sort_order?: number
          title_kk?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomenclature_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nomenclature_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nomenclature_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "nomenclature_items"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization: {
        Row: {
          bin: string | null
          created_at: string
          email: string | null
          head_user_id: string | null
          id: string
          is_active: boolean
          legal_address_kk: string | null
          legal_address_ru: string | null
          logo_url: string | null
          max_users: number | null
          name_kk: string
          name_ru: string
          phone: string | null
          reg_number_prefix: string | null
          settings: Json
          short_name_kk: string | null
          short_name_ru: string | null
          slug: string | null
          tenant_mode: string
          updated_at: string
          website: string | null
        }
        Insert: {
          bin?: string | null
          created_at?: string
          email?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean
          legal_address_kk?: string | null
          legal_address_ru?: string | null
          logo_url?: string | null
          max_users?: number | null
          name_kk?: string
          name_ru?: string
          phone?: string | null
          reg_number_prefix?: string | null
          settings?: Json
          short_name_kk?: string | null
          short_name_ru?: string | null
          slug?: string | null
          tenant_mode?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          bin?: string | null
          created_at?: string
          email?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean
          legal_address_kk?: string | null
          legal_address_ru?: string | null
          logo_url?: string | null
          max_users?: number | null
          name_kk?: string
          name_ru?: string
          phone?: string | null
          reg_number_prefix?: string | null
          settings?: Json
          short_name_kk?: string | null
          short_name_ru?: string | null
          slug?: string | null
          tenant_mode?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_head_user_id_fkey"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          code: string
          created_at: string
          description_kk: string
          description_ru: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description_kk?: string
          description_ru?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description_kk?: string
          description_ru?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          id: string
          is_head: boolean
          level: number
          title_kk: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_head?: boolean
          level?: number
          title_kk: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          is_head?: boolean
          level?: number
          title_kk?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          end_date: string | null
          id: string
          is_primary: boolean
          is_temporary: boolean
          manager_user_id: string | null
          notes: string | null
          position_id: string | null
          reason: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean
          is_temporary?: boolean
          manager_user_id?: string | null
          notes?: string | null
          position_id?: string | null
          reason?: string
          start_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean
          is_temporary?: boolean
          manager_user_id?: string | null
          notes?: string | null
          position_id?: string | null
          reason?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_assignments_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_level_id: string | null
          auth_method: string
          cert_serial: string | null
          cert_subject: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name_kk: string | null
          full_name_ru: string | null
          id: string
          iin: string | null
          locale: string
          organization_id: string
          password_hash: string | null
          position_id: string | null
          position_kk: string | null
          position_ru: string | null
          updated_at: string
        }
        Insert: {
          access_level_id?: string | null
          auth_method?: string
          cert_serial?: string | null
          cert_subject?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name_kk?: string | null
          full_name_ru?: string | null
          id?: string
          iin?: string | null
          locale?: string
          organization_id: string
          password_hash?: string | null
          position_id?: string | null
          position_kk?: string | null
          position_ru?: string | null
          updated_at?: string
        }
        Update: {
          access_level_id?: string | null
          auth_method?: string
          cert_serial?: string | null
          cert_subject?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name_kk?: string | null
          full_name_ru?: string | null
          id?: string
          iin?: string | null
          locale?: string
          organization_id?: string
          password_hash?: string | null
          position_id?: string | null
          position_kk?: string | null
          position_ru?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_access_level_id_fkey"
            columns: ["access_level_id"]
            isOneToOne: false
            referencedRelation: "ref_access_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_absence_types: {
        Row: {
          code: string
          color: string
          deducts_balance: boolean
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          requires_approval: boolean
          sort_order: number
        }
        Insert: {
          code: string
          color?: string
          deducts_balance?: boolean
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          requires_approval?: boolean
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string
          deducts_balance?: boolean
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          requires_approval?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      ref_access_levels: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          level_order: number
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          level_order?: number
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level_order?: number
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ref_archive_locations: {
        Row: {
          address_kk: string
          address_ru: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address_kk?: string
          address_ru?: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address_kk?: string
          address_ru?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ref_archive_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ref_archive_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_correspondents: {
        Row: {
          address_kk: string
          address_ru: string
          bank_account: string
          bank_name: string
          bik: string
          bin: string
          code: string
          contact_person: string
          correspondent_type: string
          created_at: string
          email: string
          external_id: string
          id: string
          iik: string
          is_active: boolean
          kbe: string
          name_kk: string
          name_ru: string
          notes: string
          organization_id: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          address_kk?: string
          address_ru?: string
          bank_account?: string
          bank_name?: string
          bik?: string
          bin?: string
          code: string
          contact_person?: string
          correspondent_type?: string
          created_at?: string
          email?: string
          external_id?: string
          id?: string
          iik?: string
          is_active?: boolean
          kbe?: string
          name_kk: string
          name_ru: string
          notes?: string
          organization_id?: string | null
          phone?: string
          updated_at?: string
        }
        Update: {
          address_kk?: string
          address_ru?: string
          bank_account?: string
          bank_name?: string
          bik?: string
          bin?: string
          code?: string
          contact_person?: string
          correspondent_type?: string
          created_at?: string
          email?: string
          external_id?: string
          id?: string
          iik?: string
          is_active?: boolean
          kbe?: string
          name_kk?: string
          name_ru?: string
          notes?: string
          organization_id?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ref_correspondents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_delivery_methods: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ref_department_kinds: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ref_document_link_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ref_document_types: {
        Row: {
          code: string
          created_at: string
          description_kk: string
          description_ru: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_kk?: string
          description_ru?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_kk?: string
          description_ru?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ref_duty_roles: {
        Row: {
          code: string
          color: string
          department_id: string | null
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sort_order: number
        }
        Insert: {
          code: string
          color?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ref_duty_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_priorities: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sla_hours: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sla_hours?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sla_hours?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ref_registration_journals: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          document_type_id: string | null
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          prefix: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          document_type_id?: string | null
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          prefix?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          document_type_id?: string | null
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          prefix?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ref_registration_journals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ref_registration_journals_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "ref_document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_rejection_reasons: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ref_retention_periods: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_permanent: boolean
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
          years: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
          years?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_permanent?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
          years?: number
        }
        Relationships: []
      }
      ref_template_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      role_definitions: {
        Row: {
          created_at: string
          description_kk: string | null
          description_ru: string | null
          permissions: Json
          role: Database["public"]["Enums"]["app_role"]
          title_kk: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_kk?: string | null
          description_ru?: string | null
          permissions?: Json
          role: Database["public"]["Enums"]["app_role"]
          title_kk: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_kk?: string | null
          description_ru?: string | null
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          title_kk?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_code: string
          role_id: string
        }
        Insert: {
          permission_code: string
          role_id: string
        }
        Update: {
          permission_code?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_system: boolean
          kind: string
          name_kk: string
          name_ru: string
          parent_role_id: string | null
          scope_department_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind?: string
          name_kk: string
          name_ru: string
          parent_role_id?: string | null
          scope_department_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind?: string
          name_kk?: string
          name_ru?: string
          parent_role_id?: string | null
          scope_department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_parent_role_id_fkey"
            columns: ["parent_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_scope_department_id_fkey"
            columns: ["scope_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          id: string
          name: string
          query: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          query?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          query?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_plan_items: {
        Row: {
          assignee_id: string | null
          code: string
          color: string
          created_at: string
          depends_on_id: string | null
          id: string
          item_type: string
          parent_id: string | null
          plan_id: string
          planned_end: string
          planned_start: string
          progress_pct: number
          sort_order: number
          status: string
          title_kk: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          code?: string
          color?: string
          created_at?: string
          depends_on_id?: string | null
          id?: string
          item_type?: string
          parent_id?: string | null
          plan_id: string
          planned_end: string
          planned_start: string
          progress_pct?: number
          sort_order?: number
          status?: string
          title_kk: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          code?: string
          color?: string
          created_at?: string
          depends_on_id?: string | null
          id?: string
          item_type?: string
          parent_id?: string | null
          plan_id?: string
          planned_end?: string
          planned_start?: string
          progress_pct?: number
          sort_order?: number
          status?: string
          title_kk?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_plan_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plan_items_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "schedule_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plan_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "schedule_plan_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "schedule_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_plans: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          id: string
          name_kk: string
          name_ru: string
          organization_id: string | null
          owner_id: string | null
          plan_type: string
          planned_end: string | null
          planned_start: string | null
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          name_kk: string
          name_ru: string
          organization_id?: string | null
          owner_id?: string | null
          plan_type?: string
          planned_end?: string | null
          planned_start?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          name_kk?: string
          name_ru?: string
          organization_id?: string | null
          owner_id?: string | null
          plan_type?: string
          planned_end?: string | null
          planned_start?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_plans_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "document_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_auth_tokens: {
        Row: {
          chat_id: string | null
          code: string | null
          confirmed_at: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          purpose: string
          token: string
          user_id: string | null
        }
        Insert: {
          chat_id?: string | null
          code?: string | null
          confirmed_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          token: string
          user_id?: string | null
        }
        Update: {
          chat_id?: string | null
          code?: string | null
          confirmed_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_auth_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_outbox: {
        Row: {
          app_link: string | null
          attempts: number
          chat_id: string
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          message_text: string
          next_retry_at: string
          notification_id: string | null
          reply_markup: Json | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          app_link?: string | null
          attempts?: number
          chat_id: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_text: string
          next_retry_at?: string
          notification_id?: string | null
          reply_markup?: Json | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          app_link?: string | null
          attempts?: number
          chat_id?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_text?: string
          next_retry_at?: string
          notification_id?: string | null
          reply_markup?: Json | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_pending_actions: {
        Row: {
          action: string
          chat_id: string
          created_at: string
          expires_at: string
          message_id: number | null
          payload: Json
          user_id: string
        }
        Insert: {
          action: string
          chat_id: string
          created_at?: string
          expires_at: string
          message_id?: number | null
          payload?: Json
          user_id: string
        }
        Update: {
          action?: string
          chat_id?: string
          created_at?: string
          expires_at?: string
          message_id?: number | null
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_pending_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_processed_updates: {
        Row: {
          chat_id: string | null
          message_id: number | null
          processed_at: string
          update_id: number
        }
        Insert: {
          chat_id?: string | null
          message_id?: number | null
          processed_at?: string
          update_id: number
        }
        Update: {
          chat_id?: string | null
          message_id?: number | null
          processed_at?: string
          update_id?: number
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          email_document_returned: boolean
          email_enabled: boolean
          email_hr_events: boolean
          email_task_assigned: boolean
          email_workflow_events: boolean
          telegram_chat_id: string | null
          telegram_document_returned: boolean
          telegram_enabled: boolean
          telegram_hr_events: boolean
          telegram_linked_at: string | null
          telegram_task_assigned: boolean
          telegram_username: string | null
          telegram_workflow_events: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_document_returned?: boolean
          email_enabled?: boolean
          email_hr_events?: boolean
          email_task_assigned?: boolean
          email_workflow_events?: boolean
          telegram_chat_id?: string | null
          telegram_document_returned?: boolean
          telegram_enabled?: boolean
          telegram_hr_events?: boolean
          telegram_linked_at?: string | null
          telegram_task_assigned?: boolean
          telegram_username?: string | null
          telegram_workflow_events?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_document_returned?: boolean
          email_enabled?: boolean
          email_hr_events?: boolean
          email_task_assigned?: boolean
          email_workflow_events?: boolean
          telegram_chat_id?: string | null
          telegram_document_returned?: boolean
          telegram_enabled?: boolean
          telegram_hr_events?: boolean
          telegram_linked_at?: string | null
          telegram_task_assigned?: boolean
          telegram_username?: string | null
          telegram_workflow_events?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_grants: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_id: string
          scope_department_id: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id: string
          scope_department_id?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string
          scope_department_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_grants_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_grants_scope_department_id_fkey"
            columns: ["scope_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_substitutions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          note: string | null
          organization_id: string | null
          principal_id: string
          substitute_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          note?: string | null
          organization_id?: string | null
          principal_id: string
          substitute_id: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          note?: string | null
          organization_id?: string | null
          principal_id?: string
          substitute_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_substitutions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_outbox: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          last_error: string | null
          next_retry_at: string
          payload: Json
          status: string
          subscription_id: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          event: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          payload?: Json
          status?: string
          subscription_id: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          event?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string
          payload?: Json
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_outbox_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          created_at: string
          created_by: string
          events: string[]
          id: string
          is_active: boolean
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          events?: string[]
          id?: string
          is_active?: boolean
          name: string
          secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      work_time_entries: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          description: string
          duration_minutes: number
          ended_at: string | null
          entry_type: string
          id: string
          project_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          description?: string
          duration_minutes?: number
          ended_at?: string | null
          entry_type?: string
          id?: string
          project_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          description?: string
          duration_minutes?: number
          ended_at?: string | null
          entry_type?: string
          id?: string
          project_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_time_entries_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "document_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          actor_id: string | null
          created_at: string
          document_id: string
          event_type: string
          id: string
          node_id: string | null
          payload: Json
          run_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          document_id: string
          event_type: string
          id?: string
          node_id?: string | null
          payload?: Json
          run_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          document_id?: string
          event_type?: string
          id?: string
          node_id?: string | null
          payload?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          context: Json
          current_node: string | null
          document_id: string
          id: string
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          context?: Json
          current_node?: string | null
          document_id: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          context?: Json
          current_node?: string | null
          document_id?: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_tasks: {
        Row: {
          action_required: string
          assignee_id: string | null
          comment: string | null
          completed_at: string | null
          created_at: string
          decision: string | null
          delegated_at: string | null
          delegated_by: string | null
          delegated_from: string | null
          document_id: string
          due_at: string | null
          escalated_at: string | null
          escalation_level: number
          id: string
          last_sla_check: string | null
          node_id: string
          node_type: string
          run_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          action_required?: string
          assignee_id?: string | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          decision?: string | null
          delegated_at?: string | null
          delegated_by?: string | null
          delegated_from?: string | null
          document_id: string
          due_at?: string | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          last_sla_check?: string | null
          node_id: string
          node_type: string
          run_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          action_required?: string
          assignee_id?: string | null
          comment?: string | null
          completed_at?: string | null
          created_at?: string
          decision?: string | null
          delegated_at?: string | null
          delegated_by?: string | null
          delegated_from?: string | null
          document_id?: string
          due_at?: string | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          last_sla_check?: string | null
          node_id?: string
          node_type?: string
          run_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tasks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_tasks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          description: string | null
          id: string
          name_kk: string
          name_ru: string
          organization_id: string | null
          status: Database["public"]["Enums"]["workflow_status"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          description?: string | null
          id?: string
          name_kk: string
          name_ru: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          description?: string | null
          id?: string
          name_kk?: string
          name_ru?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["workflow_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_business_days_ts: {
        Args: { _days: number; _start: string }
        Returns: string
      }
      app_advance_workflow_task:
        | {
            Args: { _comment?: string; _decision: string; _task_id: string }
            Returns: Json
          }
        | {
            Args: {
              _comment?: string
              _correlation_id?: string
              _decision: string
              _task_id: string
            }
            Returns: Json
          }
      app_retention_tick: { Args: never; Returns: Json }
      app_sla_tick: { Args: never; Returns: Json }
      auth_user_organization_id: { Args: never; Returns: string }
      authenticate_app_user: {
        Args: { p_email: string; p_password: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      can_act_on_workflow_task: {
        Args: { _task_id: string; _user: string }
        Returns: boolean
      }
      can_manage_document_workflow: {
        Args: { _doc_id: string; _user: string }
        Returns: boolean
      }
      can_view_document: {
        Args: { _doc_id: string; _user: string }
        Returns: boolean
      }
      can_view_document_content: {
        Args: { _doc_id: string; _user: string }
        Returns: boolean
      }
      change_app_user_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: undefined
      }
      claim_email_outbox_batch: {
        Args: { _limit?: number }
        Returns: {
          app_link: string | null
          attempts: number
          body_html: string | null
          body_text: string | null
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          next_retry_at: string
          notification_id: string | null
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_telegram_outbox_batch: {
        Args: { _limit?: number }
        Returns: {
          app_link: string | null
          attempts: number
          chat_id: string
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          message_text: string
          next_retry_at: string
          notification_id: string | null
          reply_markup: Json | null
          sent_at: string | null
          status: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "telegram_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_webhook_outbox_batch: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          event: string
          id: string
          is_active: boolean
          payload: Json
          secret: string
          subscription_id: string
          url: string
        }[]
      }
      count_business_days_between: {
        Args: { _from: string; _to: string }
        Returns: number
      }
      create_notification: {
        Args: {
          _body?: string
          _link?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      current_assignment: {
        Args: { _user: string }
        Returns: {
          created_at: string
          created_by: string | null
          department_id: string | null
          end_date: string | null
          id: string
          is_primary: boolean
          is_temporary: boolean
          manager_user_id: string | null
          notes: string | null
          position_id: string | null
          reason: string
          start_date: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profile_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_organization_id: { Args: never; Returns: string }
      delegate_workflow_task: {
        Args: { _comment?: string; _task_id: string; _to_user: string }
        Returns: Json
      }
      department_head: { Args: { _department: string }; Returns: string }
      department_parent_head: { Args: { _department: string }; Returns: string }
      document_access_level_order: {
        Args: { _doc_id: string }
        Returns: number
      }
      effective_organization_id: { Args: never; Returns: string }
      enable_document_status_bypass: { Args: never; Returns: undefined }
      ensure_my_profile: {
        Args: never
        Returns: {
          access_level_id: string | null
          auth_method: string
          cert_serial: string | null
          cert_subject: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name_kk: string | null
          full_name_ru: string | null
          id: string
          iin: string | null
          locale: string
          organization_id: string
          password_hash: string | null
          position_id: string | null
          position_kk: string | null
          position_ru: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_edms_reports: {
        Args: { _days?: number; _user: string }
        Returns: Json
      }
      get_license_status: { Args: never; Returns: Json }
      get_system_init_status: { Args: never; Returns: Json }
      grant_app_role: {
        Args: {
          _reason?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_password: { Args: { p_password: string }; Returns: string }
      is_active_substitute_for: {
        Args: { _at?: string; _principal: string; _substitute: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_approval_notification: {
        Args: { _title: string; _type: string }
        Returns: boolean
      }
      is_business_day: { Args: { _d: string }; Returns: boolean }
      jwt_organization_id: { Args: never; Returns: string }
      license_active_user_count: { Args: never; Returns: number }
      license_can_add_user: { Args: never; Returns: boolean }
      license_effective_status: {
        Args: { p_expires_at: string; p_grace_days: number; p_status: string }
        Returns: string
      }
      license_row: {
        Args: never
        Returns: {
          activated_at: string | null
          activated_by: string | null
          activation_mode: string
          created_at: string
          customer_name: string
          expires_at: string | null
          features: Json
          grace_days: number
          id: string
          installation_id: string | null
          issued_at: string | null
          last_sync_at: string | null
          last_sync_error: string
          last_sync_ok: boolean
          license_key_hash: string | null
          license_key_id: string | null
          license_server_token: string | null
          max_users: number
          notes: string
          offline_grace_hours: number
          plan: string
          server_revoked: boolean
          status: string
          sync_interval_hours: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "installation_license"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_document_reg_number: { Args: { _prefix?: string }; Returns: string }
      org_telegram_settings: {
        Args: never
        Returns: {
          default_chat_id: string
          enabled: boolean
          notify_on_approvals: boolean
          notify_on_tasks: boolean
        }[]
      }
      organization_can_add_user: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      organization_user_count: { Args: { p_org_id: string }; Returns: number }
      queue_webhook_event: {
        Args: { _event: string; _payload: Json }
        Returns: number
      }
      ref_catalog_policies: {
        Args: { _permission?: string; _table: string }
        Returns: undefined
      }
      register_app_user:
        | {
            Args: {
              p_auth_method?: string
              p_email: string
              p_full_name_kk: string
              p_full_name_ru: string
              p_iin?: string
              p_locale?: string
              p_password: string
            }
            Returns: string
          }
        | {
            Args: {
              p_auth_method?: string
              p_email: string
              p_full_name_kk: string
              p_full_name_ru: string
              p_iin?: string
              p_locale?: string
              p_organization_id?: string
              p_password: string
            }
            Returns: string
          }
      release_stale_outbox_claims: {
        Args: { _stale_minutes?: number }
        Returns: Json
      }
      resolve_document_reg_prefix: {
        Args: { _journal_id: string }
        Returns: string
      }
      resolve_document_retention_due: {
        Args: {
          _base_at?: string
          _nomenclature_id: string
          _retention_period_id: string
        }
        Returns: string
      }
      resolve_workflow_assignees: {
        Args: { _document: string; _node: Json }
        Returns: string[]
      }
      search_documents_fts: {
        Args: {
          _document_type_code?: string
          _limit?: number
          _query: string
          _scope?: string
          _scope_user?: string
          _status?: string
        }
        Returns: {
          created_at: string
          doc_type: string
          due_at: string
          id: string
          rank: number
          reg_number: string
          sla_status: Database["public"]["Enums"]["sla_status"]
          status: Database["public"]["Enums"]["document_status"]
          title_kk: string
          title_ru: string
        }[]
      }
      set_license_status: { Args: { p_status: string }; Returns: Json }
      should_send_notification_email: {
        Args: { _type: string; _user_id: string }
        Returns: boolean
      }
      should_send_notification_telegram: {
        Args: { _title: string; _type: string; _user_id: string }
        Returns: boolean
      }
      tenant_matches: { Args: { _row_org: string }; Returns: boolean }
      user_access_level_order: { Args: { _user: string }; Returns: number }
      user_can_access_document: {
        Args: { _document_id: string; _user: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _permission: string; _user: string }
        Returns: boolean
      }
      user_manager: { Args: { _user: string }; Returns: string }
      user_organization_id: { Args: { _user: string }; Returns: string }
      verify_password: {
        Args: { p_hash: string; p_password: string }
        Returns: boolean
      }
      wf_activate_node: {
        Args: {
          _depth?: number
          _doc_id: string
          _edges: Json
          _node_id: string
          _nodes: Json
          _run_id: string
        }
        Returns: string
      }
      wf_advance_from_node: {
        Args: {
          _doc_id: string
          _edges: Json
          _from_node_id: string
          _nodes: Json
          _run_id: string
        }
        Returns: string
      }
      wf_create_tasks_for_node: {
        Args: {
          _doc_id: string
          _node: Json
          _node_id: string
          _run_id: string
        }
        Returns: undefined
      }
      wf_document_field_value: {
        Args: { _doc_id: string; _field: string }
        Returns: string
      }
      wf_eval_edge_condition: {
        Args: { _condition: string; _doc_id: string }
        Returns: boolean
      }
      wf_get_outgoing_targets: {
        Args: {
          _doc_id: string
          _edges: Json
          _exclusive?: boolean
          _from_node_id: string
        }
        Returns: string[]
      }
      wf_has_pending_siblings: {
        Args: { _exclude_task: string; _node_id: string; _run_id: string }
        Returns: boolean
      }
      wf_join_predecessors_done: {
        Args: { _edges: Json; _join_id: string; _run_id: string }
        Returns: boolean
      }
      wf_node_escalation_role: { Args: { _node: Json }; Returns: string }
      wf_node_max_escalations: { Args: { _node: Json }; Returns: number }
      wf_node_parallel_mode: { Args: { _node: Json }; Returns: string }
      wf_node_sla_hours: { Args: { _node: Json }; Returns: number }
      wf_node_sla_repeat_hours: { Args: { _node: Json }; Returns: number }
      wf_node_timeout_action: { Args: { _node: Json }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "registrar"
        | "approver"
        | "signer"
        | "archivist"
        | "viewer"
        | "platform_admin"
      document_status:
        | "draft"
        | "in_review"
        | "approved"
        | "signed"
        | "rejected"
        | "archived"
        | "cancelled"
        | "submitted"
        | "returned_for_revision"
      run_status: "running" | "completed" | "cancelled" | "failed"
      signature_status: "pending" | "signed" | "rejected" | "expired"
      sla_status: "ok" | "warning" | "overdue"
      task_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "rejected"
        | "escalated"
        | "cancelled"
        | "returned"
      workflow_status: "draft" | "published" | "archived"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "admin",
        "registrar",
        "approver",
        "signer",
        "archivist",
        "viewer",
        "platform_admin",
      ],
      document_status: [
        "draft",
        "in_review",
        "approved",
        "signed",
        "rejected",
        "archived",
        "cancelled",
        "submitted",
        "returned_for_revision",
      ],
      run_status: ["running", "completed", "cancelled", "failed"],
      signature_status: ["pending", "signed", "rejected", "expired"],
      sla_status: ["ok", "warning", "overdue"],
      task_status: [
        "pending",
        "in_progress",
        "completed",
        "rejected",
        "escalated",
        "cancelled",
        "returned",
      ],
      workflow_status: ["draft", "published", "archived"],
    },
  },
} as const
