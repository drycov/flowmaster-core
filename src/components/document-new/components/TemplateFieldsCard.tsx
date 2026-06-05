// src/components/document-new/components/TemplateFieldsCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
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
        {fields.map((field) => (
          <div key={field.key}>
            <Label>
              {locale === "ru" ? field.label_ru : field.label_kk}
              {field.required && " *"}
            </Label>
            {field.type === "textarea" ? (
              <Textarea
                rows={4}
                {...register(field.key, { 
                  required: field.required,
                  shouldUnregister: true  // Важно для динамических полей
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
                  required: field.required,
                  shouldUnregister: true  // Важно для динамических полей
                })}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}