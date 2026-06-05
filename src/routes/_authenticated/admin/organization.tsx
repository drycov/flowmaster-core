import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getOrganization, updateOrganization } from "@/lib/api/org.functions";
import { listUsers } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, localized } from "@/lib/i18n";
import { Loader2, Save, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/organization")({
  component: OrganizationPage,
});

type OrgForm = {
  id: string;
  name_ru: string;
  name_kk: string;
  short_name_ru: string;
  short_name_kk: string;
  bin: string;
  legal_address_ru: string;
  legal_address_kk: string;
  phone: string;
  email: string;
  website: string;
  head_user_id: string | null;
  logo_url: string;
  reg_number_prefix: string;
};

function OrganizationPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["org"], queryFn: () => getOrganization() });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => listUsers() });
  const [form, setForm] = useState<OrgForm | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        id: data.id,
        name_ru: data.name_ru ?? "",
        name_kk: data.name_kk ?? "",
        short_name_ru: data.short_name_ru ?? "",
        short_name_kk: data.short_name_kk ?? "",
        bin: data.bin ?? "",
        legal_address_ru: data.legal_address_ru ?? "",
        legal_address_kk: data.legal_address_kk ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        website: data.website ?? "",
        head_user_id: data.head_user_id ?? null,
        logo_url: data.logo_url ?? "",
        reg_number_prefix: data.reg_number_prefix ?? "DOC",
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: () => updateOrganization({ data: form! }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["org"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (isLoading || !form) {
    return (
      <>
        <PageHeader title={t("nav.organization")} />
        <PageBody><div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></PageBody>
      </>
    );
  }

  const set = <K extends keyof OrgForm>(k: K, v: OrgForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <>
      <PageHeader
        title={t("nav.organization")}
        description={t("org.description")}
        actions={
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {t("common.save")}
          </Button>
        }
      />
      <PageBody>
        <div className="max-w-4xl space-y-6">
          <Section title={t("org.identity")} icon={<Building2 className="w-4 h-4" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={`${t("org.fullName")} (RU)`}>
                <Input value={form.name_ru} onChange={(e) => set("name_ru", e.target.value)} />
              </Field>
              <Field label={`${t("org.fullName")} (KK)`}>
                <Input value={form.name_kk} onChange={(e) => set("name_kk", e.target.value)} />
              </Field>
              <Field label={`${t("org.shortName")} (RU)`}>
                <Input value={form.short_name_ru} onChange={(e) => set("short_name_ru", e.target.value)} />
              </Field>
              <Field label={`${t("org.shortName")} (KK)`}>
                <Input value={form.short_name_kk} onChange={(e) => set("short_name_kk", e.target.value)} />
              </Field>
              <Field label={t("org.bin")}>
                <Input value={form.bin} onChange={(e) => set("bin", e.target.value)} maxLength={32} />
              </Field>
              <Field label={t("org.regPrefix")}>
                <Input value={form.reg_number_prefix} onChange={(e) => set("reg_number_prefix", e.target.value)} maxLength={32} />
              </Field>
            </div>
          </Section>

          <Section title={t("org.contacts")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t("org.phone")}><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label={t("org.email")}><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label={t("org.website")}><Input value={form.website} onChange={(e) => set("website", e.target.value)} /></Field>
              <Field label={t("org.logoUrl")}><Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field label={`${t("org.legalAddress")} (RU)`}>
                <Textarea rows={3} value={form.legal_address_ru} onChange={(e) => set("legal_address_ru", e.target.value)} />
              </Field>
              <Field label={`${t("org.legalAddress")} (KK)`}>
                <Textarea rows={3} value={form.legal_address_kk} onChange={(e) => set("legal_address_kk", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title={t("org.management")}>
            <Field label={t("org.head")}>
              <Select value={form.head_user_id ?? "__none"} onValueChange={(v) => set("head_user_id", v === "__none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {localized(u, locale, "full_name") || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>
        </div>
      </PageBody>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-sm">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-muted/40">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
