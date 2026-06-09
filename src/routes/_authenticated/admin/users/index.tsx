import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
// Добавляем функцию createUser (убедитесь, что она экспортируется из вашего API)
import { listUsers, setUserRole, createUser } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import {
  DataTableShell,
  PageState,
  PageToolbar,
  SearchField,
  TableStatusRow,
} from "@/components/PageLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // Импортируем кнопку
import { Label } from "@/components/ui/label";   // Импортируем Label для формы
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/i18n";
import { roleLabel } from "@/i18n/helpers";
import { useAccessContext } from "@/lib/access/hooks";
import { toast } from "sonner";
import { Loader2, Filter, UserPlus } from "lucide-react";
import { AdminResetPasswordDialog } from "@/components/admin/users/AdminResetPasswordDialog";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

/* =======================
   Route
======================= */

export const Route = createFileRoute("/_authenticated/admin/users/")({
  beforeLoad: () => requireModule("admin_users"),
  component: UsersAdmin,
});

/* =======================
   Roles domain
======================= */

const ROLES = [
  "admin",
  "registrar",
  "approver",
  "signer",
  "archivist",
  "viewer",
] as const;

const PLATFORM_ROLE = "platform_admin" as const;

type Role = (typeof ROLES)[number];
type TableRole = Role | typeof PLATFORM_ROLE;

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

function isTableRole(value: string): value is TableRole {
  return isRole(value) || value === PLATFORM_ROLE;
}

/* =======================
   API → UI model
======================= */

interface ApiUser {
  id: string;
  email: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  iin?: string | null;
  auth_method?: string | null;
  roles?: string[];
  created_at?: string;
  last_sign_in_at?: string;
}

interface User {
  id: string;
  email: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  iin?: string | null;
  auth_method?: string | null;
  roles: Role[];
  allRoles: string[];
  created_at?: string;
  last_sign_in_at?: string;
}

function mapUser(user: ApiUser): User {
  const allRoles = user.roles ?? [];
  return {
    ...user,
    roles: allRoles.filter(isRole),
    allRoles,
  };
}

/* =======================
   Row Component
======================= */

function UserRow({
  user,
  tableRoles,
  onRoleChange,
  isUpdating,
  updatingUserId,
  updatingRole,
  onRowClick,
}: {
  user: User;
  tableRoles: readonly TableRole[];
  onRoleChange: (userId: string, role: TableRole, enabled: boolean) => void;
  isUpdating: boolean;
  updatingUserId: string | null;
  updatingRole: TableRole | null;
  onRowClick: (userId: string) => void;
}) {
  const { t, locale } = useI18n();
  const displayName = localized(user, locale, "full_name") || "—";
  const isUserUpdating = isUpdating && updatingUserId === user.id;
  const hasEds = !!user.iin;
  const authLabel =
    user.auth_method === "both"
      ? t("profile.authMethod.both")
      : user.auth_method === "eds"
        ? t("profile.authMethod.eds")
        : t("profile.authMethod.email");

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    
    if (
      target.closest("button") || 
      target.closest("input") || 
      target.closest("[role='checkbox']")
    ) {
      return;
    }
    
    onRowClick(user.id);
  };

  return (
    <tr 
      onClick={handleRowClick}
      className="border-b border-border/60 hover:bg-muted/50 transition-colors group cursor-pointer"
    >
      <td className="px-4 py-3 align-middle max-w-[300px] truncate">
        <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
          {displayName}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 select-all">
          {user.email}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
            {authLabel}
          </Badge>
          {hasEds && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-normal border-emerald-600/40 text-emerald-700"
            >
              {t("profile.edsStatusOn")}
            </Badge>
          )}
        </div>
      </td>

      {tableRoles.map((role) => {
        const hasRole = user.allRoles.includes(role);
        const isThisRoleUpdating = isUserUpdating && updatingRole === role;

        return (
          <td key={role} className="px-2 py-3 text-center align-middle">
            <div className="inline-flex items-center justify-center relative w-6 h-6">
              {isThisRoleUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <Checkbox
                  checked={hasRole}
                  onCheckedChange={(checked) =>
                    onRoleChange(user.id, role, checked === true)
                  }
                  disabled={isUpdating}
                  className={cn("transition-transform active:scale-95")}
                />
              )}
            </div>
          </td>
        );
      })}
      <td className="px-2 py-3 text-center align-middle">
        <AdminResetPasswordDialog
          userId={user.id}
          userLabel={displayName}
          variant="ghost"
          size="icon"
        />
      </td>
    </tr>
  );
}

/* =======================
   Filters & Actions Component
======================= */

function UserFilters({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  roles,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  roles: readonly TableRole[];
}) {
  const { t } = useI18n();

  return (
    <PageToolbar>
      <SearchField
        value={searchTerm}
        onChange={onSearchChange}
        placeholder={t("users.search")}
        clearable
      />
      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-44 h-9">
          <div className="flex items-center gap-2 truncate">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <SelectValue placeholder={t("users.filterByRole")} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("users.allRoles")}</SelectItem>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {roleLabel(t, role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </PageToolbar>
  );
}

/* =======================
   Stats Component
======================= */

function UsersStats({
  users,
  roles,
}: {
  users: User[];
  roles: readonly TableRole[];
}) {
  const { t } = useI18n();

  const roleCounts = useMemo(() => {
    const counts = Object.fromEntries(roles.map((r) => [r, 0])) as Record<TableRole, number>;

    for (const u of users) {
      for (const r of u.allRoles) {
        if (isTableRole(r)) counts[r]++;
      }
    }

    return counts;
  }, [users, roles]);

  return (
    <div className="flex flex-wrap gap-2 mb-5 text-sm items-center">
      <Badge variant="secondary" className="px-2.5 py-1 font-medium">
        {t("users.totalUsers")} {users.length}
      </Badge>

      {roles.map((role) =>
        roleCounts[role] > 0 ? (
          <Badge key={role} variant="outline" className="px-2.5 py-1 font-normal text-muted-foreground">
            {roleLabel(t, role)}: {roleCounts[role]}
          </Badge>
        ) : null
      )}
    </div>
  );
}

/* =======================
   Main Admin Component
======================= */

function UsersAdmin() {
  const { t } = useI18n();
  const { can } = useAccessContext();
  const canManagePlatform = can("manage_platform");
  const tableRoles = useMemo(
    (): readonly TableRole[] =>
      canManagePlatform ? [...ROLES, PLATFORM_ROLE] : ROLES,
    [canManagePlatform],
  );
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  // Состояния для модалки создания пользователя
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFullNameRu, setNewFullNameRu] = useState("");
  const [newFullNameKk, setNewFullNameKk] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    select: (rawRows): User[] => rawRows.map(mapUser),
    staleTime: 30_000,
  });

  // Мутация создания пользователя
  const createUserMutation = useMutation({
    mutationFn: (payload: { email: string; full_name_ru: string; full_name_kk: string }) =>
      createUser({ data: payload }),
    onSuccess: () => {
      toast.success(t("admin.users.createdSuccess"));
      queryClient.invalidateQueries({ queryKey: ["users"] });
      // Очищаем форму и закрываем панель
      setNewEmail("");
      setNewFullNameRu("");
      setNewFullNameKk("");
      setIsCreateOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t("admin.users.createError"));
    },
  });

  // Мутация изменения роли
  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
      enabled,
    }: {
      userId: string;
      role: TableRole;
      enabled: boolean;
    }) =>
      setUserRole({
        data: { user_id: userId, role, enabled },
      }),
    
    onMutate: async ({ userId, role, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousUsers = queryClient.getQueryData<User[]>(["users"]);

      queryClient.setQueryData<User[]>(["users"], (old) =>
        old?.map((user) => {
          if (user.id !== userId) return user;
          const allRoles = enabled
            ? [...new Set([...user.allRoles, role])]
            : user.allRoles.filter((r) => r !== role);
          return {
            ...user,
            allRoles,
            roles: allRoles.filter(isRole),
          };
        })
      );

      return { previousUsers };
    },
    onError: (err, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(["users"], context.previousUsers);
      }
      toast.error(
        err instanceof Error ? err.message : t("admin.users.roleUpdateError")
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onSuccess: () => {
      toast.success(t("users.roleUpdated"));
    },
  });

  const filteredUsers = useMemo(() => {
    if (!data) return [];

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return data.filter((u) => {
      const matchSearch =
        !normalizedSearch ||
        u.email.toLowerCase().includes(normalizedSearch) ||
        u.full_name_ru?.toLowerCase().includes(normalizedSearch) ||
        u.full_name_kk?.toLowerCase().includes(normalizedSearch);

      const matchRole =
        roleFilter === "all" ||
        (isTableRole(roleFilter) && u.allRoles.includes(roleFilter));

      return matchSearch && matchRole;
    });
  }, [data, searchTerm, roleFilter]);

  const handleRoleChange = useCallback(
    (userId: string, role: TableRole, enabled: boolean) => {
      roleMutation.mutate({ userId, role, enabled });
    },
    [roleMutation]
  );

  const handleRowClick = useCallback((userId: string) => {
    navigate({
      to: "/admin/users/$id",
      params: { id: userId },
    });
  }, [navigate]);

  // Обработчик отправки формы создания пользователя
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error(t("admin.users.emailRequired"));
      return;
    }
    createUserMutation.mutate({
      email: newEmail.trim(),
      full_name_ru: newFullNameRu.trim(),
      full_name_kk: newFullNameKk.trim(),
    });
  };

  return (
    <PageState title={t("nav.users")} loading={isLoading} error={error}>
      <PageHeader
        title={t("nav.users")}
        actions={
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            {t("users.create")}
          </Button>
        }
      />
      <PageBody>
        <div className="space-y-4">
          <UserFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            roles={tableRoles}
          />

          <UsersStats users={data ?? []} roles={tableRoles} />

          <DataTableShell>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2">{t("users.columnUser")}</th>
                    {tableRoles.map((r) => (
                      <th
                        key={r}
                        className="px-2 py-2 text-center whitespace-nowrap min-w-[110px]"
                        title={r === PLATFORM_ROLE ? t("admin.users.platformRoleHint") : undefined}
                      >
                        {roleLabel(t, r)}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center whitespace-nowrap w-12">
                      {t("admin.users.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        tableRoles={tableRoles}
                        onRoleChange={handleRoleChange}
                        isUpdating={roleMutation.isPending}
                        updatingUserId={roleMutation.variables?.userId ?? null}
                        updatingRole={roleMutation.variables?.role ?? null}
                        onRowClick={handleRowClick}
                      />
                    ))
                  ) : (
                    <TableStatusRow colSpan={tableRoles.length + 2}>
                      {t("users.noUsers")}
                    </TableStatusRow>
                  )}
                </tbody>
              </table>
            </div>
          </DataTableShell>
        </div>

        {/* Боковая панель для СОЗДАНИЯ нового пользователя */}
        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <form onSubmit={handleCreateSubmit} className="h-full flex flex-col justify-between">
              <div>
                <SheetHeader className="pb-4 border-b">
                  <SheetTitle className="text-xl font-semibold text-foreground">
                    {t("users.createTitle")}
                  </SheetTitle>
                  <SheetDescription>{t("users.createDescription")}</SheetDescription>
                </SheetHeader>

                <div className="py-5 space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder={t("admin.users.emailPlaceholder")}
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={createUserMutation.isPending}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="fullNameRu" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("admin.users.fullNameRu")}
                    </Label>
                    <Input
                      id="fullNameRu"
                      type="text"
                      placeholder={t("profile.placeholder.fullName")}
                      value={newFullNameRu}
                      onChange={(e) => setNewFullNameRu(e.target.value)}
                      disabled={createUserMutation.isPending}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="fullNameKk" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("admin.users.fullNameKk")}
                    </Label>
                    <Input
                      id="fullNameKk"
                      type="text"
                      placeholder={t("profile.placeholder.fullName")}
                      value={newFullNameKk}
                      onChange={(e) => setNewFullNameKk(e.target.value)}
                      disabled={createUserMutation.isPending}
                    />
                  </div>
                </div>
              </div>

              <SheetFooter className="pt-4 border-t flex-row justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createUserMutation.isPending}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  {t("common.create")}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </PageBody>
    </PageState>
  );
}