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
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          pages_count: number | null
          priority_id: string | null
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
          pages_count?: number | null
          priority_id?: string | null
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
          pages_count?: number | null
          priority_id?: string | null
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
            foreignKeyName: "documents_priority_id_fkey"
            columns: ["priority_id"]
            isOneToOne: false
            referencedRelation: "ref_priorities"
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
      email_outbox: {
        Row: {
          app_link: string | null
          attempts: number
          body_html: string | null
          body_text: string | null
          created_at: string
          id: string
          last_error: string | null
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
          created_at?: string
          id?: string
          last_error?: string | null
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
          created_at?: string
          id?: string
          last_error?: string | null
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
        ]
      }
      installation_license: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string
          customer_name: string
          expires_at: string | null
          features: Json
          grace_days: number
          id: string
          installation_id: string | null
          issued_at: string | null
          license_key_hash: string | null
          max_users: number
          notes: string
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          customer_name?: string
          expires_at?: string | null
          features?: Json
          grace_days?: number
          id?: string
          installation_id?: string | null
          issued_at?: string | null
          license_key_hash?: string | null
          max_users?: number
          notes?: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          customer_name?: string
          expires_at?: string | null
          features?: Json
          grace_days?: number
          id?: string
          installation_id?: string | null
          issued_at?: string | null
          license_key_hash?: string | null
          max_users?: number
          notes?: string
          plan?: string
          status?: string
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
      nomenclature_items: {
        Row: {
          archive_rule: string
          code: string
          created_at: string
          department_id: string | null
          id: string
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
          legal_address_kk: string | null
          legal_address_ru: string | null
          logo_url: string | null
          name_kk: string
          name_ru: string
          phone: string | null
          reg_number_prefix: string | null
          settings: Json
          short_name_kk: string | null
          short_name_ru: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          bin?: string | null
          created_at?: string
          email?: string | null
          head_user_id?: string | null
          id?: string
          legal_address_kk?: string | null
          legal_address_ru?: string | null
          logo_url?: string | null
          name_kk?: string
          name_ru?: string
          phone?: string | null
          reg_number_prefix?: string | null
          settings?: Json
          short_name_kk?: string | null
          short_name_ru?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          bin?: string | null
          created_at?: string
          email?: string | null
          head_user_id?: string | null
          id?: string
          legal_address_kk?: string | null
          legal_address_ru?: string | null
          logo_url?: string | null
          name_kk?: string
          name_ru?: string
          phone?: string | null
          reg_number_prefix?: string | null
          settings?: Json
          short_name_kk?: string | null
          short_name_ru?: string | null
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
          password_hash: string | null
          position_id: string | null
          position_kk: string | null
          position_ru: string | null
          updated_at: string
        }
        Insert: {
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
          password_hash?: string | null
          position_id?: string | null
          position_kk?: string | null
          position_ru?: string | null
          updated_at?: string
        }
        Update: {
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
          password_hash?: string | null
          position_id?: string | null
          position_kk?: string | null
          position_ru?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          bin: string
          code: string
          contact_person: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          name_kk: string
          name_ru: string
          notes: string
          phone: string
          updated_at: string
        }
        Insert: {
          address_kk?: string
          address_ru?: string
          bin?: string
          code: string
          contact_person?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name_kk: string
          name_ru: string
          notes?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          address_kk?: string
          address_ru?: string
          bin?: string
          code?: string
          contact_person?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name_kk?: string
          name_ru?: string
          notes?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
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
      user_notification_preferences: {
        Row: {
          email_document_returned: boolean
          email_enabled: boolean
          email_task_assigned: boolean
          email_workflow_events: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_document_returned?: boolean
          email_enabled?: boolean
          email_task_assigned?: boolean
          email_workflow_events?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_document_returned?: boolean
          email_enabled?: boolean
          email_task_assigned?: boolean
          email_workflow_events?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          principal_id?: string
          substitute_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      change_app_user_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: undefined
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
      delegate_workflow_task: {
        Args: { _comment?: string; _task_id: string; _to_user: string }
        Returns: Json
      }
      department_head: { Args: { _department: string }; Returns: string }
      department_parent_head: { Args: { _department: string }; Returns: string }
      enable_document_status_bypass: { Args: never; Returns: undefined }
      ensure_my_profile: {
        Args: never
        Returns: {
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
          created_at: string
          customer_name: string
          expires_at: string | null
          features: Json
          grace_days: number
          id: string
          installation_id: string | null
          issued_at: string | null
          license_key_hash: string | null
          max_users: number
          notes: string
          plan: string
          status: string
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
      ref_catalog_policies: {
        Args: { _permission?: string; _table: string }
        Returns: undefined
      }
      register_app_user: {
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
      user_can_access_document: {
        Args: { _document_id: string; _user: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _permission: string; _user: string }
        Returns: boolean
      }
      user_manager: { Args: { _user: string }; Returns: string }
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
A new version of Supabase CLI is available: v2.105.0 (currently installed v2.104.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
