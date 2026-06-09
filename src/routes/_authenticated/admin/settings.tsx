import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Shield } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthSettingsPanel } from "@/components/admin/settings/AuthSettingsPanel";
import { EdsSettingsPanel } from "@/components/admin/settings/EdsSettingsPanel";
import { GeneralSettingsPanel } from "@/components/admin/settings/GeneralSettingsPanel";
import { LdapSettingsPanel } from "@/components/admin/settings/LdapSettingsPanel";
import { LicenseSettingsPanel } from "@/components/admin/settings/LicenseSettingsPanel";
import { MailSettingsPanel } from "@/components/admin/settings/MailSettingsPanel";
import { OverviewSettingsPanel } from "@/components/admin/settings/OverviewSettingsPanel";
import { ServicesSettingsPanel } from "@/components/admin/settings/ServicesSettingsPanel";
import { TelegramSettingsPanel } from "@/components/admin/settings/TelegramSettingsPanel";
import { TenantsSettingsPanel } from "@/components/admin/settings/TenantsSettingsPanel";
import { useI18n } from "@/i18n";
import { useAccessContext } from "@/lib/access/hooks";
import { requireModule } from "@/lib/access/route-guards";
import {
  getSystemSettings,
  testLdapConnection,
  testMailSettings,
  testTelegramSettings,
  updateSystemSettings,
} from "@/lib/api/system.functions";
import type { SystemSettings, SystemSettingsMeta } from "@/lib/auth/policy";
import { normalizeEmailDomains } from "@/lib/auth/policy";
import { getTelegramWebhookInfo, registerTelegramWebhookFn } from "@/lib/api/telegram.functions";

const settingsSearchSchema = z.object({
  tab: z
    .enum([
      "overview",
      "auth",
      "ldap",
      "eds",
      "general",
      "mail",
      "telegram",
      "integrations",
      "license",
      "tenants",
    ])
    .optional(),
});

export const Route = createFileRoute("/_authenticated/admin/settings")({
  validateSearch: settingsSearchSchema,
  beforeLoad: () => requireModule("admin_system", "read"),
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const { t } = useI18n();
  const { can, canModule, canAny } = useAccessContext();
  const canManagePlatform = can("manage_platform");
  const canManageLicense = canModule("admin_license", "manage");
  const canManageIntegrations = canAny("manage_integrations", "manage_license");
  const qc = useQueryClient();
  const { tab: tabFromUrl } = Route.useSearch();
  const activeTab = tabFromUrl ?? "overview";
  const [testMailTo, setTestMailTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: getSystemSettings,
  });

  const [form, setForm] = useState<SystemSettings | null>(null);
  const [meta, setMeta] = useState<SystemSettingsMeta | null>(null);
  const [domainDraft, setDomainDraft] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data.settings);
      setMeta(data.meta);
      setDomainDraft("");
      setIsDirty(false);
    }
  }, [data]);

  const testLdapMutation = useMutation({
    mutationFn: (ldap: SystemSettings["ldap"]) => testLdapConnection({ data: { ldap } }),
    onSuccess: () => toast.success(t("settings.ldap.testSuccess")),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const testMailMutation = useMutation({
    mutationFn: (to: string) => testMailSettings({ data: { to } }),
    onSuccess: () => toast.success(t("settings.mail.testSuccess")),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const { data: telegramWebhook } = useQuery({
    queryKey: ["telegram-webhook-info"],
    queryFn: getTelegramWebhookInfo,
    enabled: activeTab === "telegram",
  });

  const testTelegramMutation = useMutation({
    mutationFn: () => testTelegramSettings(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      qc.invalidateQueries({ queryKey: ["telegram-webhook-info"] });
      toast.success(t("settings.telegram.testSuccess"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const registerWebhookMutation = useMutation({
    mutationFn: () => registerTelegramWebhookFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      qc.invalidateQueries({ queryKey: ["telegram-webhook-info"] });
      toast.success(t("settings.telegram.webhookRegistered"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SystemSettings) => updateSystemSettings({ data: payload }),
    onSuccess: () => {
      toast.success(t("common.success"));
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      qc.invalidateQueries({ queryKey: ["public-auth-config"] });
      setIsDirty(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const patch = useCallback(
    <K extends keyof SystemSettings>(
      section: K,
      key: keyof SystemSettings[K],
      value: SystemSettings[K][keyof SystemSettings[K]],
    ) => {
      setForm((prev) => {
        if (!prev) return prev;
        setIsDirty(true);
        return { ...prev, [section]: { ...prev[section], [key]: value } };
      });
    },
    [],
  );

  const resetForm = () => {
    if (data) {
      setForm(data.settings);
      setMeta(data.meta);
      setDomainDraft("");
      setIsDirty(false);
    }
  };

  const addDomain = () => {
    if (!form) return;
    const normalized = normalizeEmailDomains([domainDraft]);
    if (!normalized.length) {
      toast.error(t("settings.auth.domainInvalid"));
      return;
    }
    const domain = normalized[0]!;
    if (form.auth.allowed_email_domains.includes(domain)) {
      setDomainDraft("");
      return;
    }
    patch("auth", "allowed_email_domains", [...form.auth.allowed_email_domains, domain]);
    setDomainDraft("");
  };

  const removeDomain = (domain: string) => {
    if (!form) return;
    patch(
      "auth",
      "allowed_email_domains",
      form.auth.allowed_email_domains.filter((d) => d !== domain),
    );
  };

  const effectiveSignup = useMemo(() => {
    if (!form || !meta) return false;
    return meta.bootstrap_needed || form.auth.allow_public_signup;
  }, [form, meta]);

  if (isLoading || !form || !meta) {
    return (
      <>
        <PageHeader title={t("nav.settings")} />
        <PageBody>
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("nav.settings")}
        description={t("settings.description")}
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                <RefreshCw className="mr-1 h-4 w-4" />
                {t("admin.org.reset")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {t("common.save")}
            </Button>
          </div>
        }
      />

      <PageBody className="max-w-5xl">
        <Tabs value={activeTab} className="space-y-6">
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="overview" asChild>
              <Link to="/admin/settings" search={{ tab: "overview" }}>
                {t("settings.tab.overview")}
              </Link>
            </TabsTrigger>
            <TabsTrigger value="auth" asChild>
              <Link to="/admin/settings" search={{ tab: "auth" }}>
                {t("settings.tab.auth")}
              </Link>
            </TabsTrigger>
            <TabsTrigger value="ldap" asChild>
              <Link to="/admin/settings" search={{ tab: "ldap" }}>
                {t("settings.tab.ldap")}
              </Link>
            </TabsTrigger>
            <TabsTrigger value="eds" asChild>
              <Link to="/admin/settings" search={{ tab: "eds" }}>
                {t("settings.tab.eds")}
              </Link>
            </TabsTrigger>
            <TabsTrigger value="mail" asChild>
              <Link to="/admin/settings" search={{ tab: "mail" }}>
                {t("settings.tab.mail")}
              </Link>
            </TabsTrigger>
            <TabsTrigger value="telegram" asChild>
              <Link to="/admin/settings" search={{ tab: "telegram" }}>
                {t("settings.tab.telegram")}
              </Link>
            </TabsTrigger>
            {canManageIntegrations && (
              <TabsTrigger value="integrations" asChild>
                <Link to="/admin/settings" search={{ tab: "integrations" }}>
                  {t("settings.tab.integrations")}
                </Link>
              </TabsTrigger>
            )}
            <TabsTrigger value="license" asChild>
              <Link to="/admin/settings" search={{ tab: "license" }}>
                {t("settings.tab.license")}
              </Link>
            </TabsTrigger>
            {canManagePlatform && (
              <TabsTrigger value="tenants" asChild>
                <Link to="/admin/settings" search={{ tab: "tenants" }}>
                  {t("settings.tab.tenants")}
                </Link>
              </TabsTrigger>
            )}
            <TabsTrigger value="general" asChild>
              <Link to="/admin/settings" search={{ tab: "general" }}>
                {t("settings.tab.general")}
              </Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewSettingsPanel form={form} meta={meta} effectiveSignup={effectiveSignup} />
          </TabsContent>

          <TabsContent value="auth">
            <AuthSettingsPanel
              form={form}
              meta={meta}
              patch={patch}
              domainDraft={domainDraft}
              onDomainDraftChange={setDomainDraft}
              onAddDomain={addDomain}
              onRemoveDomain={removeDomain}
            />
          </TabsContent>

          <TabsContent value="ldap">
            <LdapSettingsPanel
              form={form}
              meta={meta}
              patch={patch}
              testLdapMutation={testLdapMutation}
            />
          </TabsContent>

          <TabsContent value="eds">
            <EdsSettingsPanel form={form} patch={patch} />
          </TabsContent>

          <TabsContent value="mail">
            <MailSettingsPanel
              form={form}
              meta={meta}
              patch={patch}
              testMailTo={testMailTo}
              onTestMailToChange={setTestMailTo}
              testMailMutation={testMailMutation}
            />
          </TabsContent>

          <TabsContent value="telegram">
            <TelegramSettingsPanel
              form={form}
              meta={meta}
              patch={patch}
              telegramWebhook={telegramWebhook}
              testTelegramMutation={testTelegramMutation}
              registerWebhookMutation={registerWebhookMutation}
            />
          </TabsContent>

          {canManageIntegrations && (
            <TabsContent value="integrations">
              <ServicesSettingsPanel
                form={form}
                meta={meta}
                patch={patch}
                canManageIntegrations={canManageIntegrations}
              />
            </TabsContent>
          )}

          <TabsContent value="license">
            <LicenseSettingsPanel canManage={canManageLicense} />
          </TabsContent>

          {canManagePlatform && (
            <TabsContent value="tenants">
              <TenantsSettingsPanel />
            </TabsContent>
          )}

          <TabsContent value="general">
            <GeneralSettingsPanel form={form} patch={patch} />
          </TabsContent>
        </Tabs>

        <div className="mt-6 rounded-xl border bg-muted/30 p-5">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">{t("settings.securityNoteTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("settings.securityNote")}</p>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
