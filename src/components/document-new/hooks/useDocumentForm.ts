// src/components/document-new/hooks/useDocumentForm.ts
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/admin.functions";
import { resolveDocumentTitles } from "@/lib/templates/document-title";
import type { DocumentFormValues, Template } from "../types";
import { getTemplateFields } from "../types";

interface UseDocumentFormProps {
  templateId?: string;
  template?: Template | null;
}

export function useDocumentForm({ templateId = "none", template }: UseDocumentFormProps = {}) {
  const [internalTemplateId, setInternalTemplateId] = useState(templateId);

  useEffect(() => {
    setInternalTemplateId(templateId);
  }, [templateId]);

  const activeTemplateId = templateId !== "none" ? templateId : internalTemplateId;

  const templateFields = useMemo(() => getTemplateFields(template ?? undefined), [template]);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    staleTime: 5 * 60 * 1000,
  });

  const authorDefaults = useMemo(
    () => (me as { template_defaults?: Record<string, string> } | undefined)?.template_defaults ?? {},
    [me],
  );

  const form = useForm<DocumentFormValues>({
    defaultValues: {
      title_ru: "",
      title_kk: "",
      summary: "",
      body: "",
      nomenclature_id: "none",
      document_type_id: "",
      priority_id: "",
      correspondent_id: "",
    },
  });

  const watchedFieldKeys = useMemo(
    () => templateFields.map((field) => field.key),
    [templateFields],
  );
  const watchedFieldValues = form.watch(
    watchedFieldKeys.length > 0 ? (watchedFieldKeys as (keyof DocumentFormValues)[]) : [],
  );

  useEffect(() => {
    templateFields.forEach((field) => {
      const autoValue = authorDefaults[field.key];
      form.setValue(
        field.key as keyof DocumentFormValues,
        autoValue ?? "",
      );
    });
  }, [activeTemplateId, templateFields, authorDefaults, form]);

  useEffect(() => {
    if (!template || activeTemplateId === "none") {
      return;
    }

    const fieldValues: Record<string, string> = { ...authorDefaults };
    templateFields.forEach((field, index) => {
      const raw = Array.isArray(watchedFieldValues)
        ? watchedFieldValues[index]
        : watchedFieldValues;
      const value =
        (form.getValues(field.key as keyof DocumentFormValues) as string | undefined) ??
        (typeof raw === "string" ? raw : "");
      if (value) {
        fieldValues[field.key] = value;
      }
    });

    const { title_ru, title_kk } = resolveDocumentTitles(template, fieldValues);
    if (form.getValues("title_ru") !== title_ru) {
      form.setValue("title_ru", title_ru, { shouldValidate: true, shouldDirty: false });
    }
    if (form.getValues("title_kk") !== title_kk) {
      form.setValue("title_kk", title_kk, { shouldValidate: true, shouldDirty: false });
    }
  }, [
    activeTemplateId,
    template,
    templateFields,
    authorDefaults,
    watchedFieldValues,
    form,
  ]);

  const getTemplateFieldValues = (): Record<string, string> => {
    const values: Record<string, string> = {};
    templateFields.forEach((field) => {
      const value = form.getValues(field.key as keyof DocumentFormValues) as unknown as string;
      if (value && typeof value === "string" && value.trim() !== "") {
        values[field.key] = value;
      }
    });
    return values;
  };

  return {
    form,
    selectedTemplateId: activeTemplateId,
    setSelectedTemplateId: setInternalTemplateId,
    templateFields,
    authorDefaults,
    getTemplateFieldValues,
  };
}
