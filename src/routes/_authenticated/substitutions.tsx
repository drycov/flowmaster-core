import { createFileRoute, Link } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubstitutionActingBanner } from "@/components/substitution/SubstitutionActingBanner";
import { SubstitutionStatusBadge } from "@/components/substitution/SubstitutionStatusBadge";
import { useI18n, localized } from "@/i18n";
import { listUsersBrief, getMyProfile } from "@/lib/api/admin.functions";
import {
  createSubstitution,
  deactivateSubstitution,
  listMySubstitutions,
  listOrgSubstitutions,
} from "@/lib/api/substitutions.functions";
import { fmtDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/substitutions")({
  beforeLoad: () => requireModule("substitutions"),
  component: SubstitutionsPage,
});

function SubstitutionsPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [substituteId, setSubstituteId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMyProfile,
  });

  const canManageOrg = !!me?.permissions?.manage_org;

  const { data, isLoading } = useQuery({
    queryKey: ["my-substitutions"],
    queryFn: listMySubstitutions,
  });

  const { data: orgRows = [], isLoading: orgLoading } = useQuery({
    queryKey: ["org-substitutions"],
    queryFn: listOrgSubstitutions,
    enabled: !!canManageOrg,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-brief"],
    queryFn: listUsersBrief,
  });

  const myId = (me?.profile as { id?: string } | undefined)?.id;

  const createMut = useMutation({
    mutationFn: () =>
      createSubstitution({
        data: {
          substitute_id: substituteId,
          valid_from: new Date(validFrom).toISOString(),
          valid_until: new Date(validUntil).toISOString(),
          note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-substitutions"] });
      qc.invalidateQueries({ queryKey: ["org-substitutions"] });
      toast.success(t("substitution.created"));
      setSubstituteId("");
      setValidFrom("");
      setValidUntil("");
      setNote("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("substitution.error")),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateSubstitution({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-substitutions"] });
      qc.invalidateQueries({ queryKey: ["org-substitutions"] });
    },
  });

  const records = data?.records ?? [];
  const actingFor = data?.actingForDetails ?? [];

  return (
    <>
      <PageHeader title={t("substitution.pageTitle")} description={t("substitution.pageSubtitle")} />
      <PageBody>
        <div className="max-w-3xl mx-auto space-y-6">
          <SubstitutionActingBanner actingFor={actingFor} />

          <Tabs defaultValue="mine">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="mine">{t("substitution.tab.mine")}</TabsTrigger>
              <TabsTrigger value="acting">{t("substitution.tab.acting")}</TabsTrigger>
              {canManageOrg ? (
                <TabsTrigger value="org">{t("substitution.tab.org")}</TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="mine" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t("substitution.assignTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">{t("substitution.hint")}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label>{t("substitution.substitute")}</Label>
                      <Select
                        value={substituteId || "none"}
                        onValueChange={(v) => setSubstituteId(v === "none" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {users
                            .filter((u) => u.id !== myId)
                            .map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {localized(u, locale, "full_name") || u.email}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t("substitution.validFrom")}</Label>
                      <Input
                        type="datetime-local"
                        value={validFrom}
                        onChange={(e) => setValidFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t("substitution.validUntil")}</Label>
                      <Input
                        type="datetime-local"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>{t("doc.links.note")}</Label>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!substituteId || !validFrom || !validUntil || createMut.isPending}
                    onClick={() => createMut.mutate()}
                  >
                    {t("substitution.add")}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserRoundCog className="w-4 h-4" />
                    {t("substitution.myAssignments")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                  ) : records.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
                  ) : (
                    <div className="space-y-2">
                      {records.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-start justify-between gap-3 border rounded-sm px-3 py-2 text-sm"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {row.substitute
                                  ? localized(row.substitute, locale, "full_name")
                                  : row.substitute_id}
                              </span>
                              <SubstitutionStatusBadge
                                isActive={row.is_active}
                                validFrom={row.valid_from}
                                validUntil={row.valid_until}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fmtDateShort(row.valid_from, locale)} —{" "}
                              {fmtDateShort(row.valid_until, locale)}
                            </div>
                            {row.note ? (
                              <div className="text-xs text-muted-foreground">{row.note}</div>
                            ) : null}
                          </div>
                          {row.is_active && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deactivateMut.mutate(row.id)}
                              disabled={deactivateMut.isPending}
                            >
                              {t("substitution.deactivate")}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="acting" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t("substitution.actingListTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                  ) : actingFor.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("substitution.actingEmpty")}</p>
                  ) : (
                    <div className="space-y-2">
                      {actingFor.map((row) => (
                        <div
                          key={row.id}
                          className="border rounded-sm px-3 py-2 text-sm space-y-1 bg-amber-50/50 dark:bg-amber-950/20"
                        >
                          <div className="font-medium">
                            {row.principal
                              ? localized(row.principal, locale, "full_name")
                              : row.principal_id}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {fmtDateShort(row.valid_from, locale)} —{" "}
                            {fmtDateShort(row.valid_until, locale)}
                          </div>
                          <p className="text-xs">{t("substitution.actingTaskHint")}</p>
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/tasks">{t("nav.tasks")}</Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {canManageOrg ? (
              <TabsContent value="org" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("substitution.orgTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {orgLoading ? (
                      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                    ) : orgRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
                    ) : (
                      <div className="space-y-2">
                        {orgRows.map((row) => (
                          <div
                            key={row.id}
                            className="border rounded-sm px-3 py-2 text-sm grid sm:grid-cols-3 gap-2"
                          >
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground">
                                {t("substitution.principal")}
                              </div>
                              {row.principal
                                ? localized(row.principal, locale, "full_name")
                                : row.principal_id}
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-muted-foreground">
                                {t("substitution.substitute")}
                              </div>
                              {row.substitute
                                ? localized(row.substitute, locale, "full_name")
                                : row.substitute_id}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fmtDateShort(row.valid_from, locale)} —{" "}
                              {fmtDateShort(row.valid_until, locale)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </PageBody>
    </>
  );
}
