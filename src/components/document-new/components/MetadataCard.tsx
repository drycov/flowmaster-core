// src/components/document-new/components/MetadataCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { UseFormReturn } from "react-hook-form";
import type {
  DocumentFormValues,
  Template,
  Nomenclature,
  ReferenceBrief,
  RegistrationJournalBrief,
} from "../types";
import { TemplateSelect } from "./TemplateSelect";
import { NomenclatureSelect } from "./NomenclatureSelect";
import { ReferenceSelect } from "./ReferenceSelect";

interface MetadataCardProps {
  form: UseFormReturn<DocumentFormValues>;
  templateId: string;
  onTemplateChange: (value: string) => void;
  showManualFields: boolean;
  templates: Template[];
  nomenclatures: Nomenclature[];
  documentTypes: ReferenceBrief[];
  priorities: ReferenceBrief[];
  correspondents: ReferenceBrief[];
  registrationJournals?: RegistrationJournalBrief[];
  deliveryMethods?: ReferenceBrief[];
  isLoading?: boolean;
}

export function MetadataCard({
  form,
  templateId,
  onTemplateChange,
  showManualFields,
  templates,
  nomenclatures,
  documentTypes,
  priorities,
  correspondents,
  registrationJournals = [],
  deliveryMethods = [],
  isLoading,
}: MetadataCardProps) {
  const { t, locale } = useI18n();
  const { register, watch } = form;
  const titleRu = watch("title_ru");
  const titleKk = watch("title_kk");

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t("doc.metadata")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TemplateSelect
            value={templateId}
            onChange={onTemplateChange}
            templates={templates}
            isLoading={isLoading}
          />
          <NomenclatureSelect
            value={form.watch("nomenclature_id")}
            onChange={(v) => form.setValue("nomenclature_id", v)}
            nomenclatures={nomenclatures}
            isLoading={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ReferenceSelect
            label={t("doc.documentType")}
            value={form.watch("document_type_id")}
            onChange={(v) => form.setValue("document_type_id", v)}
            options={documentTypes}
            locale={locale}
            isLoading={isLoading}
          />
          <ReferenceSelect
            label={t("doc.priority")}
            value={form.watch("priority_id")}
            onChange={(v) => form.setValue("priority_id", v)}
            options={priorities}
            locale={locale}
            isLoading={isLoading}
          />
        </div>

        <ReferenceSelect
          label={t("doc.correspondent")}
          value={form.watch("correspondent_id")}
          onChange={(v) => form.setValue("correspondent_id", v)}
          options={correspondents}
          locale={locale}
          isLoading={isLoading}
        />

        <div className="grid grid-cols-2 gap-3">
          <ReferenceSelect
            label={t("doc.registrationJournal")}
            value={form.watch("registration_journal_id")}
            onChange={(v) => form.setValue("registration_journal_id", v)}
            options={registrationJournals}
            locale={locale}
            isLoading={isLoading}
          />
          <ReferenceSelect
            label={t("doc.deliveryMethod")}
            value={form.watch("delivery_method_id")}
            onChange={(v) => form.setValue("delivery_method_id", v)}
            options={deliveryMethods}
            locale={locale}
            isLoading={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("doc.externalRegNumber")}</Label>
            <Input {...register("external_reg_number")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t("doc.pagesCount")}</Label>
              <Input type="number" min={0} {...register("pages_count")} />
            </div>
            <div>
              <Label>{t("doc.copiesCount")}</Label>
              <Input type="number" min={0} {...register("copies_count")} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("doc.receivedAt")}</Label>
            <Input type="datetime-local" {...register("received_at")} />
          </div>
          <div>
            <Label>{t("doc.sentAt")}</Label>
            <Input type="datetime-local" {...register("sent_at")} />
          </div>
        </div>

        {showManualFields ? (
          <>
            <div>
              <Label>{t("doc.title")} (RU) *</Label>
              <Input {...register("title_ru", { required: true })} />
            </div>

            <div>
              <Label>{t("doc.title")} (KK)</Label>
              <Input {...register("title_kk")} />
            </div>
          </>
        ) : (
          <div className="rounded-sm border border-border bg-muted/30 px-3 py-2.5 space-y-1">
            <p className="text-xs text-muted-foreground">{t("doc.titleFromTemplate")}</p>
            <p className="text-sm font-medium">{titleRu || "—"}</p>
            {titleKk && titleKk !== titleRu ? (
              <p className="text-sm text-muted-foreground">{titleKk}</p>
            ) : null}
            <input type="hidden" {...register("title_ru")} />
            <input type="hidden" {...register("title_kk")} />
          </div>
        )}

        {showManualFields && (
          <>
            <div>
              <Label>{t("doc.summary")}</Label>
              <Textarea rows={2} {...register("summary")} />
            </div>
            <div>
              <Label>{t("doc.body")}</Label>
              <Textarea rows={8} {...register("body")} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
