import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ReferenceSelect,
  type ReferenceOption,
} from "@/components/document-new/components/ReferenceSelect";
import { updateDocumentMetadata } from "@/lib/api/documents.functions";
import {
  listCorrespondentsBrief,
  listAccessLevelsBrief,
  listDeliveryMethodsBrief,
  listDocumentTypesBrief,
  listPrioritiesBrief,
  listRegistrationJournalsBrief,
} from "@/lib/api/references.functions";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/documents/datetime-local";
import {
  getDocumentTypeFormProfile,
  isMetadataFieldVisible,
  resolveDocumentTypeCode,
} from "@/lib/documents/document-type-form";
import { useI18n } from "@/i18n";
import { toast } from "sonner";

type DocumentRow = {
  id: string;
  status: string;
  title_ru: string;
  title_kk?: string | null;
  summary?: string | null;
  body?: string | null;
  document_type_id?: string | null;
  priority_id?: string | null;
  correspondent_id?: string | null;
  registration_journal_id?: string | null;
  delivery_method_id?: string | null;
  access_level_id?: string | null;
  received_at?: string | null;
  sent_at?: string | null;
  pages_count?: number | null;
  copies_count?: number | null;
  external_reg_number?: string | null;
  due_at?: string | null;
};

interface EditFormValues {
  title_ru: string;
  title_kk: string;
  summary: string;
  body: string;
  document_type_id: string;
  priority_id: string;
  correspondent_id: string;
  registration_journal_id: string;
  delivery_method_id: string;
  access_level_id: string;
  received_at: string;
  sent_at: string;
  pages_count: string;
  copies_count: string;
  external_reg_number: string;
  due_at: string;
}

interface DocumentEditSheetProps {
  document: DocumentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function DocumentEditSheet({
  document,
  open,
  onOpenChange,
  onSaved,
}: DocumentEditSheetProps) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  const { data: documentTypes = [] } = useQuery({
    queryKey: ["ref-document-types-brief"],
    queryFn: listDocumentTypesBrief,
    enabled: open,
  });
  const { data: priorities = [] } = useQuery({
    queryKey: ["ref-priorities-brief"],
    queryFn: listPrioritiesBrief,
    enabled: open,
  });
  const { data: correspondents = [] } = useQuery({
    queryKey: ["ref-correspondents-brief"],
    queryFn: listCorrespondentsBrief,
    enabled: open,
  });
  const { data: journals = [] } = useQuery({
    queryKey: ["ref-registration-journals-brief"],
    queryFn: listRegistrationJournalsBrief,
    enabled: open,
  });
  const { data: deliveryMethods = [] } = useQuery({
    queryKey: ["ref-delivery-methods-brief"],
    queryFn: listDeliveryMethodsBrief,
    enabled: open,
  });
  const { data: accessLevels = [] } = useQuery({
    queryKey: ["ref-access-levels-brief"],
    queryFn: listAccessLevelsBrief,
    enabled: open,
  });

  const form = useForm<EditFormValues>({
    defaultValues: {
      title_ru: "",
      title_kk: "",
      summary: "",
      body: "",
      document_type_id: "",
      priority_id: "",
      correspondent_id: "",
      registration_journal_id: "",
      delivery_method_id: "",
      access_level_id: "",
      received_at: "",
      sent_at: "",
      pages_count: "",
      copies_count: "",
      external_reg_number: "",
      due_at: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title_ru: document.title_ru ?? "",
      title_kk: document.title_kk ?? "",
      summary: document.summary ?? "",
      body: document.body ?? "",
      document_type_id: document.document_type_id ?? "",
      priority_id: document.priority_id ?? "",
      correspondent_id: document.correspondent_id ?? "",
      registration_journal_id: document.registration_journal_id ?? "",
      delivery_method_id: document.delivery_method_id ?? "",
      access_level_id: document.access_level_id ?? "",
      received_at: toDatetimeLocal(document.received_at),
      sent_at: toDatetimeLocal(document.sent_at),
      pages_count: document.pages_count != null ? String(document.pages_count) : "",
      copies_count: document.copies_count != null ? String(document.copies_count) : "",
      external_reg_number: document.external_reg_number ?? "",
      due_at: toDatetimeLocal(document.due_at),
    });
  }, [open, document, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const pages = values.pages_count.trim() ? Number(values.pages_count) : null;
      const copies = values.copies_count.trim() ? Number(values.copies_count) : null;
      return updateDocumentMetadata({
        data: {
          id: document.id,
          title_ru: values.title_ru.trim(),
          title_kk: values.title_kk.trim() || null,
          summary: values.summary.trim() || null,
          body: values.body.trim() || null,
          document_type_id: values.document_type_id || null,
          priority_id: values.priority_id || null,
          correspondent_id: values.correspondent_id || null,
          registration_journal_id: values.registration_journal_id || null,
          delivery_method_id: values.delivery_method_id || null,
          access_level_id: values.access_level_id || null,
          received_at: fromDatetimeLocal(values.received_at),
          sent_at: fromDatetimeLocal(values.sent_at),
          due_at: fromDatetimeLocal(values.due_at),
          pages_count: Number.isFinite(pages) ? pages : null,
          copies_count: Number.isFinite(copies) ? copies : null,
          external_reg_number: values.external_reg_number.trim() || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", document.id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(t("doc.saved"));
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("doc.saveError"));
    },
  });

  const onSubmit = form.handleSubmit((values) => saveMutation.mutate(values));

  const watchedDocumentTypeId = form.watch("document_type_id");
  const documentTypeCode = useMemo(
    () => resolveDocumentTypeCode(watchedDocumentTypeId, documentTypes),
    [watchedDocumentTypeId, documentTypes],
  );
  const formProfile = useMemo(
    () => getDocumentTypeFormProfile(documentTypeCode),
    [documentTypeCode],
  );
  const show = (field: Parameters<typeof isMetadataFieldVisible>[1]) =>
    isMetadataFieldVisible(formProfile, field);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("doc.edit")}</SheetTitle>
          <SheetDescription>{t("doc.metadata")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label>{t("doc.title")} (RU) *</Label>
            <Input {...form.register("title_ru", { required: true })} />
          </div>
          <div>
            <Label>{t("doc.title")} (KK)</Label>
            <Input {...form.register("title_kk")} />
          </div>
          <div>
            <Label>{t("doc.summary")}</Label>
            <Textarea rows={2} {...form.register("summary")} />
          </div>
          <div>
            <Label>{t("doc.body")}</Label>
            <Textarea rows={4} {...form.register("body")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ReferenceSelect
              label={t("doc.documentType")}
              value={form.watch("document_type_id")}
              onChange={(v) => form.setValue("document_type_id", v)}
              options={documentTypes as ReferenceOption[]}
              locale={locale}
            />
            <ReferenceSelect
              label={t("doc.priority")}
              value={form.watch("priority_id")}
              onChange={(v) => form.setValue("priority_id", v)}
              options={priorities as ReferenceOption[]}
              locale={locale}
            />
          </div>

          {show("correspondent_id") ? (
            <ReferenceSelect
              label={t("doc.correspondent")}
              value={form.watch("correspondent_id")}
              onChange={(v) => form.setValue("correspondent_id", v)}
              options={correspondents as ReferenceOption[]}
              locale={locale}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {show("registration_journal_id") ? (
              <ReferenceSelect
                label={t("doc.registrationJournal")}
                value={form.watch("registration_journal_id")}
                onChange={(v) => form.setValue("registration_journal_id", v)}
                options={journals as ReferenceOption[]}
                locale={locale}
              />
            ) : (
              <div />
            )}
            {show("delivery_method_id") ? (
              <ReferenceSelect
                label={t("doc.deliveryMethod")}
                value={form.watch("delivery_method_id")}
                onChange={(v) => form.setValue("delivery_method_id", v)}
                options={deliveryMethods as ReferenceOption[]}
                locale={locale}
              />
            ) : (
              <div />
            )}
          </div>

          <ReferenceSelect
            label={t("access.level")}
            value={form.watch("access_level_id")}
            onChange={(v) => form.setValue("access_level_id", v)}
            options={accessLevels as ReferenceOption[]}
            locale={locale}
          />

          {show("external_reg_number") ? (
            <div>
              <Label>{t("doc.externalRegNumber")}</Label>
              <Input {...form.register("external_reg_number")} />
            </div>
          ) : null}

          {show("pages_count") || show("copies_count") ? (
            <div className="grid grid-cols-2 gap-3">
              {show("pages_count") ? (
                <div>
                  <Label>{t("doc.pagesCount")}</Label>
                  <Input type="number" min={0} {...form.register("pages_count")} />
                </div>
              ) : null}
              {show("copies_count") ? (
                <div>
                  <Label>{t("doc.copiesCount")}</Label>
                  <Input type="number" min={0} {...form.register("copies_count")} />
                </div>
              ) : null}
            </div>
          ) : null}

          {show("received_at") || show("sent_at") ? (
            <div className="grid grid-cols-2 gap-3">
              {show("received_at") ? (
                <div>
                  <Label>{t("doc.receivedAt")}</Label>
                  <Input type="datetime-local" {...form.register("received_at")} />
                </div>
              ) : (
                <div />
              )}
              {show("sent_at") ? (
                <div>
                  <Label>{t("doc.sentAt")}</Label>
                  <Input type="datetime-local" {...form.register("sent_at")} />
                </div>
              ) : (
                <div />
              )}
            </div>
          ) : null}

          <div>
            <Label>{t("common.deadline")}</Label>
            <Input type="datetime-local" {...form.register("due_at")} />
          </div>

          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t("doc.saving") : t("doc.save")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
