import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Save, ShieldCheck, Trash2, UserPlus, Ban } from "lucide-react";
import { toast } from "sonner";
import {
  listRolesV2,
  listPermissions,
  upsertRoleV2,
  setRolePermissions,
  listRoleGrants,
  grantRole,
  revokeRoleGrant,
  listUsers,
} from "@/lib/api/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesPage,
});

type RoleV2 = {
  id: string;
  code: string;
  name_ru: string;
  name_kk: string;
  description: string;
  kind: "system" | "org" | "department" | "temporary";
  is_active: boolean;
  is_system: boolean;
  permission_codes: string[];
};

function RolesPage() {
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles-v2"],
    queryFn: () => listRolesV2(),
  });
  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => listPermissions(),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = (roles as RoleV2[]).find((r) => r.id === selectedId) ?? null;

  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [permsDirty, setPermsDirty] = useState(false);

  const handleSelect = (r: RoleV2) => {
    setSelectedId(r.id);
    setDraftPerms(new Set(r.permission_codes));
    setPermsDirty(false);
  };

  const togglePerm = (code: string, checked: boolean) => {
    setDraftPerms((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    setPermsDirty(true);
  };

  const savePerms = useMutation({
    mutationFn: () =>
      setRolePermissions({
        data: { role_id: selectedId!, permission_codes: Array.from(draftPerms) },
      }),
    onSuccess: () => {
      toast.success("Разрешения сохранены");
      setPermsDirty(false);
      qc.invalidateQueries({ queryKey: ["roles-v2"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const categories = useMemo(() => {
    const m = new Map<string, typeof permissions>();
    (permissions as Array<{ code: string; category: string; description_ru: string }>).forEach(
      (p) => {
        const arr = m.get(p.category) ?? [];
        arr.push(p as never);
        m.set(p.category, arr);
      },
    );
    return Array.from(m.entries());
  }, [permissions]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Роли и разрешения" />
        <PageBody>
          <Loader2 className="animate-spin" />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Роли и разрешения"
        description="Матрица RBAC, временные grant'ы"
        actions={<NewRoleDialog onCreated={() => qc.invalidateQueries({ queryKey: ["roles-v2"] })} />}
      />
      <PageBody>
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT: roles list */}
          <Card className="col-span-4 rounded-sm">
            <CardHeader>
              <CardTitle className="text-sm">Роли</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y border-t">
                {(roles as RoleV2[]).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    className={`w-full text-left px-4 py-2 hover:bg-muted/50 ${
                      selectedId === r.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{r.name_ru}</span>
                      {r.is_system && (
                        <Badge variant="outline" className="text-[10px]">
                          system
                        </Badge>
                      )}
                      {!r.is_active && (
                        <Badge variant="secondary" className="text-[10px]">
                          off
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {r.code} · {r.kind} · {r.permission_codes.length} прав
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: permissions matrix + grants */}
          <div className="col-span-8 space-y-4">
            {!selected ? (
              <Card className="rounded-sm">
                <CardContent className="p-12 text-center text-muted-foreground text-sm">
                  Выберите роль слева, чтобы редактировать разрешения и grant'ы
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="rounded-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        {selected.name_ru}{" "}
                        <span className="text-xs text-muted-foreground font-mono">
                          ({selected.code})
                        </span>
                      </CardTitle>
                    </div>
                    <Button
                      size="sm"
                      disabled={!permsDirty || savePerms.isPending}
                      onClick={() => savePerms.mutate()}
                    >
                      {savePerms.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Сохранить
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categories.map(([cat, perms]) => (
                      <div key={cat}>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                          {cat}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(perms as Array<{ code: string; description_ru: string }>).map(
                            (p) => (
                              <label
                                key={p.code}
                                className="flex items-start gap-2 p-2 rounded hover:bg-muted/40 cursor-pointer"
                              >
                                <Checkbox
                                  checked={draftPerms.has(p.code)}
                                  onCheckedChange={(c) => togglePerm(p.code, !!c)}
                                />
                                <div className="text-sm">
                                  <div className="font-mono text-xs">{p.code}</div>
                                  {p.description_ru && (
                                    <div className="text-xs text-muted-foreground">
                                      {p.description_ru}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <GrantsCard roleId={selected.id} roleName={selected.name_ru} users={users as never} />
              </>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}

function NewRoleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name_ru: "",
    name_kk: "",
    description: "",
    kind: "org" as "system" | "org" | "department" | "temporary",
  });
  const mut = useMutation({
    mutationFn: () => upsertRoleV2({ data: form }),
    onSuccess: () => {
      toast.success("Роль создана");
      setOpen(false);
      setForm({ code: "", name_ru: "", name_kk: "", description: "", kind: "org" });
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Новая роль
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая роль</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <Label>Код (a-z0-9_)</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div>
            <Label>Название (RU)</Label>
            <Input
              value={form.name_ru}
              onChange={(e) => setForm({ ...form, name_ru: e.target.value })}
            />
          </div>
          <div>
            <Label>Атауы (KK)</Label>
            <Input
              value={form.name_kk}
              onChange={(e) => setForm({ ...form, name_kk: e.target.value })}
            />
          </div>
          <div>
            <Label>Тип</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => setForm({ ...form, kind: v as never })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Системная</SelectItem>
                <SelectItem value="org">Организационная</SelectItem>
                <SelectItem value="department">Подразделения</SelectItem>
                <SelectItem value="temporary">Временная</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrantsCard({
  roleId,
  roleName,
  users,
}: {
  roleId: string;
  roleName: string;
  users: Array<{ id: string; full_name_ru: string | null; email: string }>;
}) {
  const qc = useQueryClient();
  const { data: grants = [] } = useQuery({
    queryKey: ["role-grants", roleId],
    queryFn: () => listRoleGrants({ data: { role_id: roleId } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ user_id: string; expires_at: string; reason: string }>(
    { user_id: "", expires_at: "", reason: "" },
  );

  const grantMut = useMutation({
    mutationFn: () =>
      grantRole({
        data: {
          user_id: form.user_id,
          role_id: roleId,
          expires_at: form.expires_at
            ? new Date(form.expires_at).toISOString()
            : null,
          reason: form.reason,
        },
      }),
    onSuccess: () => {
      toast.success("Роль выдана");
      setOpen(false);
      setForm({ user_id: "", expires_at: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["role-grants", roleId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeRoleGrant({ data: { grant_id: id } }),
    onSuccess: () => {
      toast.success("Grant отозван");
      qc.invalidateQueries({ queryKey: ["role-grants", roleId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Выданные роли — {roleName}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <UserPlus className="w-4 h-4 mr-1" />
              Выдать
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Выдать роль</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <div>
                <Label>Пользователь</Label>
                <Select
                  value={form.user_id}
                  onValueChange={(v) => setForm({ ...form, user_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите пользователя" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name_ru || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Срок действия (опционально)</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Основание</Label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Приказ №…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!form.user_id || grantMut.isPending}
                onClick={() => grantMut.mutate()}
              >
                Выдать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-y text-xs">
            <tr>
              <th className="text-left px-3 py-2">Пользователь</th>
              <th className="text-left px-3 py-2">Выдано</th>
              <th className="text-left px-3 py-2">Действует до</th>
              <th className="text-left px-3 py-2">Статус</th>
              <th className="px-3 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {(grants as Array<{
              id: string;
              user_id: string;
              granted_at: string;
              expires_at: string | null;
              revoked_at: string | null;
              reason: string | null;
              profiles?: { full_name_ru: string | null; email: string } | null;
            }>).map((g) => (
              <tr key={g.id} className="border-b">
                <td className="px-3 py-2">
                  {g.profiles?.full_name_ru || g.profiles?.email || g.user_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(g.granted_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">
                  {g.expires_at ? new Date(g.expires_at).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  {g.revoked_at ? (
                    <Badge variant="destructive" className="text-[10px]">
                      отозван
                    </Badge>
                  ) : g.expires_at && new Date(g.expires_at) < new Date() ? (
                    <Badge variant="secondary" className="text-[10px]">
                      истёк
                    </Badge>
                  ) : (
                    <Badge className="text-[10px]">активен</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  {!g.revoked_at && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => revokeMut.mutate(g.id)}
                      title="Отозвать"
                    >
                      <Ban className="w-4 h-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {(grants as unknown[]).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Нет выданных grant'ов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// keep linter happy for unused import
void Trash2;
