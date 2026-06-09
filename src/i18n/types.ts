export type Locale = "ru" | "kk";

export interface Dictionary {
  [key: string]: string;
}

export type FieldType =
  | "name"
  | "title"
  | "full_name"
  | "description"
  | "body"
  | "summary";

export interface LocalizableFields {
  name_ru?: string | null;
  name_kk?: string | null;
  title_ru?: string | null;
  title_kk?: string | null;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  description_ru?: string | null;
  description_kk?: string | null;
  body_ru?: string | null;
  body_kk?: string | null;
  summary_ru?: string | null;
  summary_kk?: string | null;
}
