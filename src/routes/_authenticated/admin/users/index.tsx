import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { listUsers, setUserRole } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n, localized } from "@/lib/i18n";
import { toast } from "sonner";
import { Loader2, Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/* =======================
   Route
======================= */

export const Route = createFileRoute("/_authenticated/admin/users/")({
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

type Role = (typeof ROLES)[number];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/* =======================
   API → UI model
======================= */

interface ApiUser {
  id: string;
  email: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  roles?: string[];
  created_at?: string;
  last_sign_in_at?: string;
}

interface User {
  id: string;
  email: string;
  full_name_ru?: string | null;
  full_name_kk?: string | null;
  roles: Role[];
  created_at?: string;
  last_sign_in_at?: string;
}

function mapUser(user: ApiUser): User {
  return {
    ...user,
    roles: (user.roles ?? []).filter(isRole),
  };
}

/* =======================
   Row Component
======================= */

function UserRow({
  user,
  roles,
  onRoleChange,
  isUpdating,
  updatingUserId,
  updatingRole,
  onRowClick,
}: {
  user: User;
  roles: readonly Role[];
  onRoleChange: (userId: string, role: Role, enabled: boolean) => void;
  isUpdating: boolean;
  updatingUserId: string | null;
  updatingRole: Role | null;
  onRowClick: (user: User) => void;
}) {
  const { locale } = useI18n();

  const displayName = localized(user, locale, "full_name") || "—";
  const isUserUpdating = isUpdating && updatingUserId === user.id;

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    
    // Предотвращаем открытие панели, если кликнули по чекбоксу или его обертке
    if (
      target.closest("button") || 
      target.closest("input") || 
      target.closest("[role='checkbox']")
    ) {
      return;
    }
    
    onRowClick(user);
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
      </td>

      {roles.map((role) => {
        const hasRole = user.roles.includes(role);
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
                  className={cn(
                    "transition-transform active:scale-95",
                    hasRole && "border-primary text-primary-foreground"
                  )}
                />
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

/* =======================
   Filters Component
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
  roles: readonly Role[];
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

        <Input
          placeholder={t("users.search") || "Поиск пользователей..."}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9 h-10"
        />

        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-full sm:w-56 h-10">
          <div className="flex items-center gap-2 truncate">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <SelectValue placeholder={t("users.filterByRole") || "Все роли"} />
          </div>
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="all">
            {t("users.allRoles") || "Все роли"}
          </SelectItem>

          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {t(`roles.${role}`) || role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
  roles: readonly Role[];
}) {
  const { t } = useI18n();

  const roleCounts = useMemo(() => {
    const counts: Record<Role, number> = {
      admin: 0,
      registrar: 0,
      approver: 0,
      signer: 0,
      archivist: 0,
      viewer: 0,
    };

    for (const u of users) {
      for (const r of u.roles) {
        if (r in counts) counts[r]++;
      }
    }

    return counts;
  }, [users]);

  return (
    <div className="flex flex-wrap gap-2 mb-5 text-sm items-center">
      <Badge variant="secondary" className="px-2.5 py-1 font-medium bg-secondary text-secondary-foreground">
        {t("users.totalUsers") || "Пользователи"}: {users.length}
      </Badge>

      {roles.map((role) =>
        roleCounts[role] > 0 ? (
          <Badge key={role} variant="outline" className="px-2.5 py-1 font-normal text-muted-foreground bg-background">
            {t(`roles.${role}`) || role}: {roleCounts[role]}
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
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    select: (rawRows): User[] => rawRows.map(mapUser),
    staleTime: 30_000,
  });

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
      enabled,
    }: {
      userId: string;
      role: Role;
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
          return {
            ...user,
            roles: enabled
              ? [...user.roles, role]
              : user.roles.filter((r) => r !== role),
          };
        })
      );

      // Синхронизируем состояние боковой панели, если она открыта для этого пользователя
      setSelectedUser((current) => {
        if (!current || current.id !== userId) return current;
        return {
          ...current,
          roles: enabled
            ? [...current.roles, role]
            : current.roles.filter((r) => r !== role),
        };
      });

      return { previousUsers };
    },
    onError: (err, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(["users"], context.previousUsers);
        
        // Откатываем состояние и в боковой панели
        const originalUser = context.previousUsers.find(u => u.id === variables.userId);
        if (originalUser) setSelectedUser(originalUser);
      }
      toast.error(
        err instanceof Error ? err.message : "Ошибка при обновлении роли"
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onSuccess: () => {
      toast.success(t("users.roleUpdated") || "Роль успешно обновлена");
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
        roleFilter === "all" || u.roles.includes(roleFilter as Role);

      return matchSearch && matchRole;
    });
  }, [data, searchTerm, roleFilter]);

  const handleRoleChange = useCallback(
    (userId: string, role: Role, enabled: boolean) => {
      roleMutation.mutate({ userId, role, enabled });
    },
    [roleMutation]
  );

  const handleRowClick = useCallback((user: User) => {
    setSelectedUser(user);
  }, []);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("nav.users") || "Пользователи"} />
        <PageBody>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t("nav.users") || "Пользователи"} />
        <PageBody>
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive text-sm">
            {error instanceof Error ? error.message : "Не удалось загрузить данные"}
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("nav.users") || "Пользователи"} />
      <PageBody>
        <div className="space-y-4">
          <UserFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            roles={ROLES}
          />

          <UsersStats users={data ?? []} roles={ROLES} />

          <div className="rounded-md border border-border bg-background overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold text-foreground/80 h-11 align-middle">
                      {t("users.user") || "Пользователи"}
                    </th>
                    {ROLES.map((r) => (
                      <th
                        key={r}
                        className="px-2 py-3 text-center font-semibold text-foreground/80 h-11 align-middle whitespace-nowrap min-w-[110px]"
                      >
                        {t(`roles.${r}`) || r}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/40">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        roles={ROLES}
                        onRoleChange={handleRoleChange}
                        isUpdating={roleMutation.isPending}
                        updatingUserId={roleMutation.variables?.userId ?? null}
                        updatingRole={roleMutation.variables?.role ?? null}
                        onRowClick={handleRowClick}
                      />
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={ROLES.length + 1}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        Пользователи не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Боковая панель деталей пользователя */}
        <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <SheetContent className="w-full sm:max-w-md">
            {selectedUser && (
              <>
                <SheetHeader className="pb-4 border-b">
                  <SheetTitle className="text-xl font-semibold text-foreground">
                    {localized(selectedUser, locale, "full_name") || "Без имени"}
                  </SheetTitle>
                  <SheetDescription className="text-xs font-mono mt-1 text-muted-foreground select-all">
                    ID: {selectedUser.id}
                  </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-5 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Email
                    </span>
                    <span className="font-medium text-foreground text-base select-all">
                      {selectedUser.email}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Дата создания
                    </span>
                    <span className="text-foreground">
                      {selectedUser.created_at 
                        ? new Date(selectedUser.created_at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'kk-KZ', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : "—"}
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-border/60">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Назначенные роли
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUser.roles.length > 0 ? (
                        selectedUser.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="px-2.5 py-0.5 font-medium">
                            {t(`roles.${r}`) || r}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs italic">
                          У пользователя нет активных ролей
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </PageBody>
    </>
  );
}