import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useI18n, localized } from "@/i18n";
import { listUsersBrief } from "@/lib/api/admin.functions";
import {
  createSubstitution,
  deactivateSubstitution,
  listMySubstitutions,
} from "@/lib/api/substitutions.functions";
import { fmtDateShort } from "@/lib/format";
import { toast } from "sonner";
import { UserRoundCog } from "lucide-react";

export function SubstitutionsCard() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [substituteId, setSubstituteId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-substitutions"],
    queryFn: listMySubstitutions,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-brief"],
    queryFn: listUsersBrief,
  });

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

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
      toast.success(t("substitution.created"));
      setSubstituteId("");
      setNote("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("substitution.error")),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateSubstitution({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-substitutions"] }),
  });

  const records = data?.records ?? [];

  return (
    <Card className="rounded-sm">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <UserRoundCog className="w-4 h-4" />
          {t("substitution.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("substitution.hint")}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>{t("substitution.substitute")}</Label>
            <Select value={substituteId || "none"} onValueChange={(v) => setSubstituteId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {localized(u, locale, "full_name") || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("substitution.validFrom")}</Label>
            <Input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t("substitution.validUntil")}</Label>
            <Input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="col-span-2">
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

        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {!isLoading && records.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        )}
        <div className="space-y-2">
          {records.map((row: any) => {
            const sub = userMap[row.substitute_id];
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 border border-border rounded-sm px-3 py-2 text-sm"
              >
                <div>
                  <div>{sub ? localized(sub, locale, "full_name") : row.substitute_id}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDateShort(row.valid_from, locale)} — {fmtDateShort(row.valid_until, locale)}
                    {!row.is_active ? ` · ${t("substitution.inactive")}` : ""}
                  </div>
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
