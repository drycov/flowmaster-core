// src/components/template-editor/hooks/useTemplateData.ts
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTemplate } from "@/lib/api/templates.functions";
import type { TemplateStatus, Field } from "../types";

interface UseTemplateDataReturn {
  nameRu: string;
  nameKk: string;
  category: string;
  description: string;
  status: TemplateStatus;
  fields: Field[];
  body: string;
  defaultWorkflowId: string | null;
  allowCustomRoute: boolean;
  filePath: string | null;
  fileFormat: string | null;
  isLoading: boolean;
  setNameRu: (value: string) => void;
  setNameKk: (value: string) => void;
  setCategory: (value: string) => void;
  setDescription: (value: string) => void;
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
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TemplateStatus>("draft");
  const [fields, setFields] = useState<Field[]>([]);
  const [body, setBody] = useState("");
  const [defaultWorkflowId, setDefaultWorkflowId] = useState<string | null>(null);
  const [allowCustomRoute, setAllowCustomRoute] = useState<boolean>(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileFormat, setFileFormat] = useState<string | null>(null);

  useEffect(() => {
    if (!tpl) return;
    const t = tpl as any;
    setNameRu(t.name_ru || "");
    setNameKk(t.name_kk || "");
    setCategory(t.category || "general");
    setDescription(t.description || "");
    setStatus((t.status as TemplateStatus) || "draft");

    const schema = t.schema as { fields?: Field[]; body_template?: string };
    setFields(schema?.fields || []);
    setBody(schema?.body_template || "");
    setDefaultWorkflowId(t.default_workflow_id ?? null);
    setAllowCustomRoute(t.allow_custom_route ?? true);
    setFilePath(t.file_path ?? null);
    setFileFormat(t.file_format ?? null);
  }, [tpl]);

  return {
    nameRu,
    nameKk,
    category,
    description,
    status,
    fields,
    body,
    defaultWorkflowId,
    allowCustomRoute,
    filePath,
    fileFormat,
    isLoading,
    setNameRu,
    setNameKk,
    setCategory,
    setDescription,
    setStatus,
    setFields,
    setBody,
    setDefaultWorkflowId,
    setAllowCustomRoute,
  };
}
