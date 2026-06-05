import { Json } from "@/integrations/supabase/types";

// src/components/templates-list/types.ts
export interface Template {
  id: string;
  name_ru: string;
  name_kk: string;
  category: string;
  status: string; // Изменено с литерала на string
  version: number;
  schema?: Json | null; // Добавляем Json тип
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  description?: string | null;
  file_format?: string;
  file_path?: string | null;
}

// Или если нужно сохранить строгую типизацию, используем union с string
export type TemplateStatus = "draft" | "published" | "archived" | string;

export interface Template {
  id: string;
  name_ru: string;
  name_kk: string;
  category: string;
  status: TemplateStatus;
  version: number;
  schema?: Json | null; // Используем Json тип
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  description?: string | null;
  file_format?: string;
  file_path?: string | null;
}