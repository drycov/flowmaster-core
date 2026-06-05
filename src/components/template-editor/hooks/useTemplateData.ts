// src/components/template-editor/hooks/useTemplateData.ts
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTemplate } from "@/lib/api/templates.functions";
import type { TemplateStatus, Field } from "../types";

interface UseTemplateDataReturn {
  nameRu: string;
  nameKk: string;
  category: string;
  status: TemplateStatus;
  fields: Field[];
  body: string;
  isLoading: boolean;
  setNameRu: (value: string) => void;
  setNameKk: (value: string) => void;
  setCategory: (value: string) => void;
  setStatus: (value: TemplateStatus) => void;
  setFields: (value: Field[] | ((prev: Field[]) => Field[])) => void;
  setBody: (value: string) => void;
}

export function useTemplateData(templateId: string): UseTemplateDataReturn {
  const { data: tpl, isLoading } = useQuery({
    queryKey: ["tpl", templateId],
    queryFn: () => getTemplate({ data: { id: templateId } }),
  });

  const [nameRu, setNameRu] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState<TemplateStatus>("draft");
  const [fields, setFields] = useState<Field[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!tpl) return;
    
    setNameRu(tpl.name_ru || "");
    setNameKk(tpl.name_kk || "");
    setCategory(tpl.category || "general");
    setStatus((tpl.status as TemplateStatus) || "draft");
    
    const schema = tpl.schema as { fields?: Field[]; body_template?: string };
    setFields(schema?.fields || []);
    setBody(schema?.body_template || "");
  }, [tpl]);

  return {
    nameRu,
    nameKk,
    category,
    status,
    fields,
    body,
    isLoading,
    setNameRu,
    setNameKk,
    setCategory,
    setStatus,
    setFields,
    setBody,
  };
}