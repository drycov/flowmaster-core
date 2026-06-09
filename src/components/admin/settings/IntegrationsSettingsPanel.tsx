import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plug, Key, Webhook, Upload, Loader2, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/i18n";
import {
  API_KEY_SCOPES,
  WEBHOOK_EVENTS_ACTIVE,
  createApiKey,
  createWebhookSubscription,
  listApiKeys,
  listImportJobs,
  listWebhookSubscriptions,
  revokeApiKey,
  testWebhookSubscription,
  toggleWebhookSubscription,
  type ApiKeyScope,
} from "@/lib/api/integrations.functions";
import { fmtDate } from "@/lib/format";
import { FailedDeliveriesPanel } from "./FailedDeliveriesPanel";

export function IntegrationsSettingsPanel({ canManage = true }: { canManage?: boolean }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<ApiKeyScope[]>(["documents:read", "tasks:read"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>([...WEBHOOK_EVENTS_ACTIVE]);
  const [newWhSecret, setNewWhSecret] = useState<string | null>(null);

  const { data: keys = [] } = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys });
  const { data: webhooks = [] } = useQuery({
    queryKey: ["webhook-subs"],
    queryFn: listWebhookSubscriptions,
  });
  const { data: imports = [] } = useQuery({ queryKey: ["import-jobs"], queryFn: listImportJobs });

  const createKeyMutation = useMutation({
    mutationFn: () => createApiKey({ data: { name: keyName.trim(), scopes: keyScopes } }),
    onSuccess: (row) => {
      setNewSecret(row.secret);
      setKeyName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success(t("integrations.keyCreated"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("integrations.error")),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success(t("integrations.keyRevoked"));
    },
  });

  const createWhMutation = useMutation({
    mutationFn: () =>
      createWebhookSubscription({
        data: {
          name: whName.trim(),
          url: whUrl.trim(),
          events: whEvents as (typeof WEBHOOK_EVENTS_ACTIVE)[number][],
        },
      }),
    onSuccess: (row) => {
      setNewWhSecret(row.secret);
      setWhName("");
      setWhUrl("");
      qc.invalidateQueries({ queryKey: ["webhook-subs"] });
      toast.success(t("integrations.webhookCreated"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("integrations.error")),
  });

  const toggleWhMutation = useMutation({
    mutationFn: (args: { id: string; is_active: boolean }) =>
      toggleWebhookSubscription({ data: args }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-subs"] }),
  });

  const testWhMutation = useMutation({
    mutationFn: (id: string) => testWebhookSubscription({ data: { id } }),
    onSuccess: () => toast.success(t("integrations.webhookTestOk")),
    onError: (e) => toast.error(e instanceof Error ? e.message : t("integrations.error")),
  });

  const toggleScope = (scope: ApiKeyScope, on: boolean) => {
    setKeyScopes((prev) => (on ? [...new Set([...prev, scope])] : prev.filter((s) => s !== scope)));
  };

  const toggleEvent = (event: string, on: boolean) => {
    setWhEvents((prev) => (on ? [...new Set([...prev, event])] : prev.filter((e) => e !== event)));
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-app";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("integrations.subtitle")}</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plug className="h-4 w-4" />
            {t("integrations.apiDocs")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 font-mono text-xs text-muted-foreground">
          <div>GET {baseUrl}/api/v1/documents</div>
          <div>POST {baseUrl}/api/v1/documents</div>
          <div>GET {baseUrl}/api/v1/documents/:id</div>
          <div>PATCH {baseUrl}/api/v1/documents/:id</div>
          <div>PATCH {baseUrl}/api/v1/documents/:id/status</div>
          <div>POST {baseUrl}/api/v1/documents/:id/versions</div>
          <div>GET {baseUrl}/api/v1/tasks</div>
          <div>POST {baseUrl}/api/v1/tasks/:id/complete</div>
          <div>GET {baseUrl}/api/v1/contracts</div>
          <div>POST {baseUrl}/api/v1/import/incoming</div>
          <p className="pt-2 font-sans text-foreground">{t("integrations.authHint")}</p>
          <p className="pt-1 font-sans text-xs text-muted-foreground">
            {t("integrations.docsHint")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Key className="h-4 w-4" />
            {t("integrations.apiKeys")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newSecret ? (
            <div className="space-y-2 rounded-sm border border-amber-500/50 bg-amber-50/50 p-3 dark:bg-amber-950/20">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {t("integrations.copySecretNow")}
              </p>
              <div className="flex gap-2">
                <code className="flex-1 break-all text-xs">{newSecret}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(newSecret);
                    toast.success(t("integrations.copied"));
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setNewSecret(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          ) : null}

          {canManage && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t("integrations.keyName")}</Label>
                  <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("integrations.scopes")}</Label>
                  {API_KEY_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={keyScopes.includes(scope)}
                        onCheckedChange={(c) => toggleScope(scope, c === true)}
                      />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                disabled={!keyName.trim() || keyScopes.length === 0 || createKeyMutation.isPending}
                onClick={() => createKeyMutation.mutate()}
              >
                {createKeyMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : null}
                {t("integrations.createKey")}
              </Button>
            </>
          )}

          <div className="space-y-2 pt-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-sm border p-2 text-sm"
              >
                <div>
                  <div className="font-medium">{k.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {k.key_prefix}… · {(k.scopes as string[]).join(", ")}
                  </div>
                  {k.last_used_at ? (
                    <div className="text-[10px] text-muted-foreground">
                      {t("integrations.lastUsed")}: {fmtDate(k.last_used_at, locale)}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={k.is_active ? "default" : "secondary"}>
                    {k.is_active ? t("integrations.active") : t("integrations.revoked")}
                  </Badge>
                  {canManage && k.is_active ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => revokeMutation.mutate(k.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Webhook className="h-4 w-4" />
            {t("integrations.webhooks")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newWhSecret ? (
            <div className="rounded-sm border bg-muted/30 p-3 text-xs">
              <p>{t("integrations.webhookSecret")}:</p>
              <code className="break-all">{newWhSecret}</code>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => setNewWhSecret(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          ) : null}

          {canManage && (
            <>
              <div className="grid gap-3">
                <div>
                  <Label>{t("integrations.webhookName")}</Label>
                  <Input value={whName} onChange={(e) => setWhName(e.target.value)} />
                </div>
                <div>
                  <Label>URL</Label>
                  <Input
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("integrations.events")}</Label>
                  {WEBHOOK_EVENTS_ACTIVE.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={whEvents.includes(ev)}
                        onCheckedChange={(c) => toggleEvent(ev, c === true)}
                      />
                      {ev}
                    </label>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                disabled={!whName.trim() || !whUrl.trim() || whEvents.length === 0}
                onClick={() => createWhMutation.mutate()}
              >
                {t("integrations.createWebhook")}
              </Button>
            </>
          )}

          <div className="space-y-2">
            {webhooks.map((w) => (
              <div key={w.id} className="flex justify-between rounded-sm border p-2 text-sm">
                <div>
                  <div className="font-medium">{w.name}</div>
                  <div className="max-w-md truncate text-xs text-muted-foreground">{w.url}</div>
                </div>
                {canManage ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!w.is_active || testWhMutation.isPending}
                      onClick={() => testWhMutation.mutate(w.id)}
                    >
                      {t("integrations.webhookTest")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleWhMutation.mutate({ id: w.id, is_active: !w.is_active })}
                    >
                      {w.is_active ? t("integrations.disable") : t("integrations.enable")}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("integrations.webhookCron")}</p>
          <p className="text-xs text-muted-foreground">{t("integrations.cronSecretHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" />
            {t("integrations.importJobs")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("integrations.noImports")}</p>
          ) : (
            <div className="space-y-2">
              {imports.map((job) => (
                <div key={job.id} className="flex justify-between rounded-sm border p-2 text-sm">
                  <div>
                    <span className="font-mono text-xs">{job.id.slice(0, 8)}…</span>
                    <span className="ml-2">{job.kind}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {job.success_count}/{job.total_count} · {job.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FailedDeliveriesPanel />
    </div>
  );
}
