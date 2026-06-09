import { createFileRoute } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { getOrganization, updateOrganization } from "@/lib/api/org.functions";
import { listUsers } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import { Loader2, Save, Building2, RefreshCw, Brain, Contact2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/organization")({
  beforeLoad: () => requireModule("admin_org"),
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

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["org"],
    queryFn: getOrganization,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const [form, setForm] = useState<OrgForm | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize form
  useEffect(() => {
    if (org && !form) {
      setForm({
        id: org.id,
        name_ru: org.name_ru ?? "",
        name_kk: org.name_kk ?? "",
        short_name_ru: org.short_name_ru ?? "",
        short_name_kk: org.short_name_kk ?? "",
        bin: org.bin ?? "",
        legal_address_ru: org.legal_address_ru ?? "",
        legal_address_kk: org.legal_address_kk ?? "",
        phone: org.phone ?? "",
        email: org.email ?? "",
        website: org.website ?? "",
        head_user_id: org.head_user_id ?? null,
        logo_url: org.logo_url ?? "",
        reg_number_prefix: org.reg_number_prefix ?? "DOC",
      });
    }
  }, [org, form]);

  const saveMutation = useMutation({
    mutationFn: (data: OrgForm) => updateOrganization({ data }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["org"] });
      setIsDirty(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const updateField = useCallback(<K extends keyof OrgForm>(key: K, value: OrgForm[K]) => {
    setForm((prev) => {
      if (!prev) return prev;
      const newForm = { ...prev, [key]: value };
      setIsDirty(true);
      return newForm;
    });
  }, []);

  const resetForm = () => {
    if (org) {
      setForm({
        id: org.id,
        name_ru: org.name_ru ?? "",
        name_kk: org.name_kk ?? "",
        short_name_ru: org.short_name_ru ?? "",
        short_name_kk: org.short_name_kk ?? "",
        bin: org.bin ?? "",
        legal_address_ru: org.legal_address_ru ?? "",
        legal_address_kk: org.legal_address_kk ?? "",
        phone: org.phone ?? "",
        email: org.email ?? "",
        website: org.website ?? "",
        head_user_id: org.head_user_id ?? null,
        logo_url: org.logo_url ?? "",
        reg_number_prefix: org.reg_number_prefix ?? "DOC",
      });
      setIsDirty(false);
    }
  };

  if (orgLoading || !form) {
    return (
      <>
        <PageHeader title={t("nav.organization")} />
        <PageBody>
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("nav.organization")}
        description={t("org.description")}
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {t("admin.org.reset")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {t("common.save")}
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          <div className="space-y-6">

            {/* Identity Section */}
            <Section title={t("org.identity")} icon={<Building2 className="w-4 h-4" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={`${t("org.fullName")} (RU)`}>
                  <Input
                    value={form.name_ru}
                    onChange={(e) => updateField("name_ru", e.target.value)}
                  />
                </Field>
                <Field label={`${t("org.fullName")} (KK)`}>
                  <Input
                    value={form.name_kk}
                    onChange={(e) => updateField("name_kk", e.target.value)}
                  />
                </Field>

                <Field label={`${t("org.shortName")} (RU)`}>
                  <Input
                    value={form.short_name_ru}
                    onChange={(e) => updateField("short_name_ru", e.target.value)}
                  />
                </Field>
                <Field label={`${t("org.shortName")} (KK)`}>
                  <Input
                    value={form.short_name_kk}
                    onChange={(e) => updateField("short_name_kk", e.target.value)}
                  />
                </Field>

                <Field label={t("org.bin")}>
                  <Input
                    value={form.bin}
                    onChange={(e) => updateField("bin", e.target.value)}
                    maxLength={12}
                    placeholder="123456789012"
                  />
                </Field>

                <Field label={t("org.regPrefix")}>
                  <Input
                    value={form.reg_number_prefix}
                    onChange={(e) => updateField("reg_number_prefix", e.target.value)}
                    maxLength={10}
                    placeholder="DOC"
                  />
                </Field>
              </div>
            </Section>

            {/* Contacts Section */}
            <Section title={t("org.contacts")} icon={<Contact2 className="w-4 h-4" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t("org.phone")}>
                  <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
                </Field>
                <Field label={t("org.email")}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </Field>
                <Field label={t("org.website")}>
                  <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} />
                </Field>
                <Field label={t("org.logoUrl")}>
                  <Input value={form.logo_url} onChange={(e) => updateField("logo_url", e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <Field label={`${t("org.legalAddress")} (RU)`}>
                  <Textarea
                    rows={3}
                    value={form.legal_address_ru}
                    onChange={(e) => updateField("legal_address_ru", e.target.value)}
                  />
                </Field>
                <Field label={`${t("org.legalAddress")} (KK)`}>
                  <Textarea
                    rows={3}
                    value={form.legal_address_kk}
                    onChange={(e) => updateField("legal_address_kk", e.target.value)}
                  />
                </Field>
              </div>
            </Section>
          </div>
          <div className="space-y-6">

            {/* Management Section */}
            <Section title={t("org.management")} icon={<Brain className="w-4 h-4" />}>
              <Field label={t("org.head")}>
                <Select
                  value={form.head_user_id ?? "__none"}
                  onValueChange={(v) => updateField("head_user_id", v === "__none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.org.notAssigned")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("admin.org.notAssignedFull")}</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {localized(u, locale, "full_name") || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Section>
          </div>
        </div>

      </PageBody>
    </>
  );
}

/* Reusable Components */
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-muted/50">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}