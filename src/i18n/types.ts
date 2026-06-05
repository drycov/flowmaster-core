export type Locale = "ru" | "kk";

export interface Dictionary {
  [key: string]: string;
}

export type FieldType = "name" | "title" | "full_name" | "description";

export interface LocalizableFields {
  name_ru?: string | null;
  name_kk?: string | null;
  title_ru?: string | null;
  title_kk?: string | null;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  description_ru?: string | null;
  description_kk?: string | null;
}