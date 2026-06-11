// src/components/document-new/components/TemplateFieldsCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import {
  isAutoFilledTemplateField,
  resolveTemplateFieldSource,
} from "@/lib/templates/template-field-source";
import type { UseFormReturn } from "react-hook-form";
import type { TemplateField, DocumentFormValues } from "../types";

interface TemplateFieldsCardProps {
  form: UseFormReturn<DocumentFormValues>;
  fields: TemplateField[];
  authorDefaults?: Record<string, string>;
}

function autoFillHintKey(source: ReturnType<typeof resolveTemplateFieldSource>): string {
  switch (source) {
    case "author":
      return "doc.executorFromAuthor";
    case "signatory":
      return "doc.signatoryAutoFill";
    case "organization":
      return "doc.organizationAutoFill";
    case "system":
      return "doc.systemAutoFill";
    default:
      return "doc.executorFromAuthor";
  }
}

export function TemplateFieldsCard({ form, fields, authorDefaults = {} }: TemplateFieldsCardProps) {
  const { t, locale } = useI18n();
  const { register, watch } = form;

  const userFields = fields.filter((field) => !isAutoFilledTemplateField(field));
  const autoFields = fields.filter((field) => isAutoFilledTemplateField(field));

  if (fields.length === 0) return null;

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("tpl.fields")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {userFields.map((field) => (
          <div key={field.key}>
            <Label>
              {locale === "ru" ? field.label_ru : field.label_kk}
              {field.required ? " *" : ""}
            </Label>
            {field.type === "textarea" ? (
              <Textarea
                rows={4}
                {...register(field.key, {
                  required: field.required ? `${field.label_ru} — обязательное поле` : false,
                  shouldUnregister: true,
                })}
              />
            ) : (
              <Input
                type={
                  field.type === "number" ? "number" : field.type === "date" ? "date" : "text"
                }
                {...register(field.key, {
                  required: field.required ? `${field.label_ru} — обязательное поле` : false,
                  shouldUnregister: true,
                })}
              />
            )}
          </div>
        ))}

        {autoFields.length > 0 ? (
          <div className="space-y-2 rounded-sm border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">{t("doc.autoFilledFields")}</p>
            {autoFields.map((field) => {
              const source = resolveTemplateFieldSource(field);
              if (source === "system") return null;

              const value =
                watch(field.key)?.trim() ||
                authorDefaults[field.key]?.trim() ||
                (source === "organization" ? "—" : "—");

              return (
                <div key={field.key}>
                  <Label className="text-muted-foreground">
                    {locale === "ru" ? field.label_ru : field.label_kk}
                  </Label>
                  <p className="mb-0.5 text-xs text-muted-foreground">{t(autoFillHintKey(source))}</p>
                  <Input value={value} readOnly disabled className="bg-background/60" />
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
