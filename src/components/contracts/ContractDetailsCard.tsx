import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useI18n, localized } from "@/i18n";
import { upsertContractDetails, ensureContractFromDocument } from "@/lib/api/contracts.functions";
import { listCorrespondentsBrief } from "@/lib/api/references.functions";
import type { ReferenceBriefRow } from "@/lib/api/reference-types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";
import { fmtDateShort } from "@/lib/format";

type ContractRow = {
  document_id: string;
  contract_number?: string;
  contract_date?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  amount?: number | null;
  currency?: string;
  contract_status?: string;
  counterparty_id?: string | null;
  subject_ru?: string;
  subject_kk?: string;
  payment_terms?: string;
  auto_renew?: boolean;
  ref_correspondents?: { id: string; name_ru: string; name_kk: string; code: string } | null;
};

export function ContractDetailsCard({
  documentId,
  contract,
  canEdit,
}: {
  documentId: string;
  contract: ContractRow | null;
  canEdit: boolean;
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(!contract);

  const [form, setForm] = useState({
    contract_number: contract?.contract_number ?? "",
    contract_date: contract?.contract_date?.slice(0, 10) ?? "",
    valid_from: contract?.valid_from?.slice(0, 10) ?? "",
    valid_to: contract?.valid_to?.slice(0, 10) ?? "",
    amount: contract?.amount?.toString() ?? "",
    currency: contract?.currency ?? "KZT",
    contract_status: contract?.contract_status ?? "draft",
    counterparty_id: contract?.counterparty_id ?? "",
    subject_ru: contract?.subject_ru ?? "",
    payment_terms: contract?.payment_terms ?? "",
    auto_renew: contract?.auto_renew ?? false,
  });

  const { data: correspondents = [] } = useQuery<ReferenceBriefRow[]>({
    queryKey: ["ref-correspondents-brief"],
    queryFn: listCorrespondentsBrief,
    enabled: editing,
  });

  const ensureMut = useMutation({
    mutationFn: () => ensureContractFromDocument({ data: { document_id: documentId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      setEditing(true);
    },
  });

  const saveMut = useMutation({
    mutationFn: () =>
      upsertContractDetails({
        data: {
          document_id: documentId,
          contract_number: form.contract_number,
          contract_date: form.contract_date || null,
          valid_from: form.valid_from || null,
          valid_to: form.valid_to || null,
          amount: form.amount ? Number(form.amount) : null,
          currency: form.currency,
          contract_status: form.contract_status as never,
          counterparty_id: form.counterparty_id || null,
          subject_ru: form.subject_ru,
          payment_terms: form.payment_terms,
          auto_renew: form.auto_renew,
        },
      }),
    onSuccess: () => {
      toast.success(t("contract.saved"));
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      qc.invalidateQueries({ queryKey: ["contract", documentId] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("contract.error")),
  });

  if (!contract && !canEdit) return null;

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <ScrollText className="w-4 h-4" />
          {t("contract.title")}
        </CardTitle>
        {canEdit && contract && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t("common.edit")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!contract && canEdit && (
          <Button size="sm" onClick={() => ensureMut.mutate()} disabled={ensureMut.isPending}>
            {t("contract.register")}
          </Button>
        )}

        {contract && !editing && (
          <dl className="space-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("contract.number")}</dt>
              <dd className="font-mono">{contract.contract_number || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("common.status")}</dt>
              <dd>{t(`contract.status.${contract.contract_status ?? "draft"}`)}</dd>
            </div>
            {contract.valid_from || contract.valid_to ? (
              <div>
                <dt className="text-xs text-muted-foreground">{t("contract.validity")}</dt>
                <dd>
                  {contract.valid_from ? fmtDateShort(contract.valid_from, locale) : "…"} —{" "}
                  {contract.valid_to ? fmtDateShort(contract.valid_to, locale) : "…"}
                </dd>
              </div>
            ) : null}
            {contract.amount != null && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("contract.amount")}</dt>
                <dd>
                  {contract.amount.toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU")}{" "}
                  {contract.currency}
                </dd>
              </div>
            )}
            {contract.ref_correspondents && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("doc.correspondent")}</dt>
                <dd>{localized(contract.ref_correspondents, locale, "name")}</dd>
              </div>
            )}
          </dl>
        )}

        {editing && (
          <div className="grid gap-3">
            <div>
              <Label>{t("contract.number")}</Label>
              <Input
                value={form.contract_number}
                onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("contract.date")}</Label>
                <Input
                  type="date"
                  value={form.contract_date}
                  onChange={(e) => setForm((f) => ({ ...f, contract_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("common.status")}</Label>
                <Select
                  value={form.contract_status}
                  onValueChange={(v) => setForm((f) => ({ ...f, contract_status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["draft", "negotiation", "active", "expired", "terminated"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`contract.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("contract.validFrom")}</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("contract.validTo")}</Label>
                <Input
                  type="date"
                  value={form.valid_to}
                  onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t("contract.amount")}</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("contract.currency")}</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>{t("doc.correspondent")}</Label>
              <Select
                value={form.counterparty_id || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, counterparty_id: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {correspondents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {localized(c, locale, "name") || c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("contract.subject")}</Label>
              <Input
                value={form.subject_ru}
                onChange={(e) => setForm((f) => ({ ...f, subject_ru: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.auto_renew}
                onCheckedChange={(v) => setForm((f) => ({ ...f, auto_renew: v }))}
              />
              <Label>{t("contract.autoRenew")}</Label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {t("common.save")}
              </Button>
              {contract && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
