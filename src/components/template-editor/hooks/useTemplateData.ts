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
  defaultWorkflowId: string | null;
  allowCustomRoute: boolean;
  isLoading: boolean;
  setNameRu: (value: string) => void;
  setNameKk: (value: string) => void;
  setCategory: (value: string) => void;
  setStatus: (value: TemplateStatus) => void;
  setFields: (value: Field[] | ((prev: Field[]) => Field[])) => void;
  setBody: (value: string) => void;
  setDefaultWorkflowId: (value: string | null) => void;
  setAllowCustomRoute: (value: boolean) => void;
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
  const [defaultWorkflowId, setDefaultWorkflowId] = useState<string | null>(null);
  const [allowCustomRoute, setAllowCustomRoute] = useState<boolean>(true);

  useEffect(() => {
    if (!tpl) return;
    const t = tpl as any;
    setNameRu(t.name_ru || "");
    setNameKk(t.name_kk || "");
    setCategory(t.category || "general");
    setStatus((t.status as TemplateStatus) || "draft");

    const schema = t.schema as { fields?: Field[]; body_template?: string };
    setFields(schema?.fields || []);
    setBody(schema?.body_template || "");
    setDefaultWorkflowId(t.default_workflow_id ?? null);
    setAllowCustomRoute(t.allow_custom_route ?? true);
  }, [tpl]);

  return {
    nameRu,
    nameKk,
    category,
    status,
    fields,
    body,
    defaultWorkflowId,
    allowCustomRoute,
    isLoading,
    setNameRu,
    setNameKk,
    setCategory,
    setStatus,
    setFields,
    setBody,
    setDefaultWorkflowId,
    setAllowCustomRoute,
  };
}
