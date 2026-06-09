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
  public: {
    Tables: {
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
      document_signatures: {
        Row: {
          cert_issuer: string | null
          cert_serial: string | null
          cert_subject: string | null
          created_at: string
          document_id: string
          id: string
          payload: string | null
          signature_type: string
          signed_at: string | null
          signer_id: string
          status: Database["public"]["Enums"]["signature_status"]
          version_id: string | null
        }
        Insert: {
          cert_issuer?: string | null
          cert_serial?: string | null
          cert_subject?: string | null
          created_at?: string
          document_id: string
          id?: string
          payload?: string | null
          signature_type?: string
          signed_at?: string | null
          signer_id: string
          status?: Database["public"]["Enums"]["signature_status"]
          version_id?: string | null
        }
        Update: {
          cert_issuer?: string | null
          cert_serial?: string | null
          cert_subject?: string | null
          created_at?: string
          document_id?: string
          id?: string
          payload?: string | null
          signature_type?: string
          signed_at?: string | null
          signer_id?: string
          status?: Database["public"]["Enums"]["signature_status"]
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
          archived_at: string | null
          assigned_to: string | null
          body: string | null
          created_at: string
          created_by: string
          current_version: number
          custom_route: Json | null
          correspondent_id: string | null
          department_id: string | null
          doc_type: string
          document_type_id: string | null
          due_at: string | null
          id: string
          legal_hold: boolean
          nomenclature_id: string | null
          priority_id: string | null
          reg_number: string
          search_tsv: unknown
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
          archived_at?: string | null
          assigned_to?: string | null
          body?: string | null
          created_at?: string
          created_by: string
          current_version?: number
          custom_route?: Json | null
          correspondent_id?: string | null
          department_id?: string | null
          doc_type?: string
          document_type_id?: string | null
          due_at?: string | null
          id?: string
          legal_hold?: boolean
          nomenclature_id?: string | null
          priority_id?: string | null
          reg_number: string
          search_tsv?: unknown
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
          archived_at?: string | null
          assigned_to?: string | null
          body?: string | null
          correspondent_id?: string | null
          created_at?: string
          created_by?: string
          current_version?: number
          custom_route?: Json | null
          department_id?: string | null
          doc_type?: string
          document_type_id?: string | null
          due_at?: string | null
          id?: string
          legal_hold?: boolean
          nomenclature_id?: string | null
          priority_id?: string | null
          reg_number?: string
          search_tsv?: unknown
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
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
        Relationships: []
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
          short_name_kk?: string | null
          short_name_ru?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
            foreignKeyName: "profile_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name_kk: string | null
          full_name_ru: string | null
          id: string
          locale: string
          position_id: string | null
          position_kk: string | null
          position_ru: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name_kk?: string | null
          full_name_ru?: string | null
          id: string
          locale?: string
          position_id?: string | null
          position_kk?: string | null
          position_ru?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name_kk?: string | null
          full_name_ru?: string | null
          id?: string
          locale?: string
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
          current_node: string | null
          document_id: string
          id: string
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          current_node?: string | null
          document_id: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          current_node?: string | null
          document_id?: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          workflow_id?: string
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_advance_workflow_task: {
        Args: { _comment?: string; _decision: string; _task_id: string }
        Returns: Json
      }
      app_sla_tick: { Args: never; Returns: Json }
      can_view_document: {
        Args: { _doc_id: string; _user: string }
        Returns: boolean
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
      department_head: { Args: { _department: string }; Returns: string }
      department_parent_head: { Args: { _department: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      resolve_workflow_assignees: {
        Args: { _document: string; _node: Json }
        Returns: string[]
      }
      user_has_permission: {
        Args: { _permission: string; _user: string }
        Returns: boolean
      }
      user_manager: { Args: { _user: string }; Returns: string }
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
        | "returned"
        | "escalated"
        | "cancelled"
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
      ],
      workflow_status: ["draft", "published", "archived"],
    },
  },
} as const
