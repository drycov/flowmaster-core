// src/components/document-new/components/TemplateFieldsCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { isAuthorExecutorField, isAuthorSignatoryField } from "@/lib/templates/author-field-values";
import type { UseFormReturn } from "react-hook-form";
import type { TemplateField, DocumentFormValues } from "../types";

interface TemplateFieldsCardProps {
  form: UseFormReturn<DocumentFormValues>;
  fields: TemplateField[];
}

export function TemplateFieldsCard({ form, fields }: TemplateFieldsCardProps) {
  const { t, locale } = useI18n();
  const { register } = form;

  if (fields.length === 0) return null;

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("tpl.fields")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field) => {
          const isAutoField =
            isAuthorExecutorField(field.key) || isAuthorSignatoryField(field.key);
          const isRequired = field.required && !isAutoField;

          return (
          <div key={field.key}>
            <Label>
              {locale === "ru" ? field.label_ru : field.label_kk}
              {isRequired && " *"}
            </Label>
            {isAuthorExecutorField(field.key) && (
              <p className="mb-1 text-xs text-muted-foreground">{t("doc.executorFromAuthor")}</p>
            )}
            {isAuthorSignatoryField(field.key) && (
              <p className="mb-1 text-xs text-muted-foreground">{t("doc.signatoryAutoFill")}</p>
            )}
            {field.type === "textarea" ? (
              <Textarea
                rows={4}
                {...register(field.key, {
                  required: isRequired ? `${field.label_ru} — обязательное поле` : false,
                  shouldUnregister: true,
                })}
              />
            ) : (
              <Input
                type={
                  field.type === "number" 
                    ? "number" 
                    : field.type === "date" 
                    ? "date" 
                    : "text"
                }
                {...register(field.key, {
                  required: isRequired ? `${field.label_ru} — обязательное поле` : false,
                  shouldUnregister: true,
                })}
              />
            )}
          </div>
          );
        })}
      </CardContent>
    </Card>
  );
}