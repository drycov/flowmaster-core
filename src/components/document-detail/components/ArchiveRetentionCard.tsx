import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceSelect } from "@/components/document-new/components/ReferenceSelect";
import { updateDocumentMetadata } from "@/lib/api/documents.functions";
import {
  listArchiveLocationsBrief,
  listRetentionPeriodsBrief,
} from "@/lib/api/references.functions";
import { useI18n, localized } from "@/i18n";
import { fmtDateShort } from "@/lib/format";
import { toast } from "sonner";
import { Archive, ShieldAlert } from "lucide-react";

type DocRow = {
  id: string;
  legal_hold?: boolean;
  legal_hold_note?: string | null;
  legal_hold_at?: string | null;
  retention_due_at?: string | null;
  archived_at?: string | null;
  archive_location_id?: string | null;
  retention_period_id?: string | null;
  ref_retention_periods?: { name_ru: string; name_kk: string; years?: number; is_permanent?: boolean } | null;
  ref_archive_locations?: { name_ru: string; name_kk: string } | null;
  nomenclature_items?: { retention_years?: number } | null;
};

interface ArchiveRetentionCardProps {
  document: DocRow;
  canManage?: boolean;
}

export function ArchiveRetentionCard({ document, canManage = false }: ArchiveRetentionCardProps) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [holdNote, setHoldNote] = useState(document.legal_hold_note ?? "");

  const { data: retentionPeriods = [] } = useQuery({
    queryKey: ["ref-retention-periods"],
    queryFn: listRetentionPeriodsBrief,
    enabled: canManage,
  });
  const { data: archiveLocations = [] } = useQuery({
    queryKey: ["ref-archive-locations"],
    queryFn: listArchiveLocationsBrief,
    enabled: canManage,
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateDocumentMetadata({
        data: { id: document.id, ...patch } as never,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document", document.id] });
      toast.success(t("archive.saved"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("archive.error")),
  });

  const retentionLabel = (() => {
    const rp = document.ref_retention_periods;
    if (rp) {
      const name = localized(rp as { name_ru: string; name_kk: string }, locale, "name");
      return (rp as { is_permanent?: boolean }).is_permanent
        ? `${name} (${t("archive.permanent")})`
        : name;
    }
    const years = document.nomenclature_items?.retention_years;
    return years ? `${years} ${t("archive.years")}` : "—";
  })();

  const archiveLocation = document.ref_archive_locations
    ? localized(
        document.ref_archive_locations as { name_ru: string; name_kk: string },
        locale,
        "name",
      )
    : "—";

  return (
    <Card className={`rounded-sm ${document.legal_hold ? "border-amber-500/50" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {document.legal_hold ? (
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          ) : (
            <Archive className="w-4 h-4" />
          )}
          {t("archive.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-medium">{t("archive.legalHold")}</p>
            {document.legal_hold && document.legal_hold_at && (
              <p className="text-xs text-muted-foreground">
                {fmtDateShort(document.legal_hold_at, locale)}
              </p>
            )}
          </div>
          <Switch
            checked={!!document.legal_hold}
            disabled={!canManage || saveMutation.isPending}
            onCheckedChange={(checked) =>
              saveMutation.mutate({
                legal_hold: checked,
                legal_hold_note: checked ? holdNote.trim() || null : null,
              })
            }
          />
        </div>

        {canManage && (
          <div>
            <Label className="text-xs">{t("archive.legalHoldNote")}</Label>
            <Input
              value={holdNote}
              onChange={(e) => setHoldNote(e.target.value)}
              disabled={!document.legal_hold}
              placeholder={t("archive.legalHoldNotePlaceholder")}
            />
            {document.legal_hold && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={saveMutation.isPending}
                onClick={() =>
                  saveMutation.mutate({ legal_hold: true, legal_hold_note: holdNote.trim() || null })
                }
              >
                {t("archive.saveNote")}
              </Button>
            )}
          </div>
        )}

        {!canManage && document.legal_hold_note && (
          <p className="text-xs text-muted-foreground">{document.legal_hold_note}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block">{t("archive.retention")}</span>
            <span>{retentionLabel}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">{t("archive.retentionDue")}</span>
            <span>
              {document.retention_due_at
                ? fmtDateShort(document.retention_due_at, locale)
                : t("archive.permanent")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">{t("archive.location")}</span>
            <span>{archiveLocation}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">{t("archive.archivedAt")}</span>
            <span>
              {document.archived_at ? fmtDateShort(document.archived_at, locale) : "—"}
            </span>
          </div>
        </div>

        {canManage && (
          <div className="space-y-2 pt-1 border-t border-border">
            <ReferenceSelect
              label={t("archive.retentionPeriod")}
              value={document.retention_period_id ?? ""}
              onChange={(v) => saveMutation.mutate({ retention_period_id: v || null })}
              options={retentionPeriods as never[]}
              locale={locale}
            />
            <ReferenceSelect
              label={t("archive.location")}
              value={document.archive_location_id ?? ""}
              onChange={(v) => saveMutation.mutate({ archive_location_id: v || null })}
              options={archiveLocations as never[]}
              locale={locale}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
