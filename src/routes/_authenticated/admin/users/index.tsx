import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { listUsers, setUserRole } from "@/lib/api/admin.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
   Row
======================= */

function UserRow({
  user,
  roles,
  onRoleChange,
  isUpdating,
  updatingUserId,
  updatingRole,
}: {
  user: User;
  roles: readonly Role[];
  onRoleChange: (userId: string, role: Role, enabled: boolean) => void;
  isUpdating: boolean;
  updatingUserId: string | null;
  updatingRole: Role | null;
}) {
  const { locale, t } = useI18n();

  const displayName =
    localized(user, locale, "full_name") || "—";

  const isUserUpdating =
    isUpdating && updatingUserId === user.id;

  return (
    <tr className="border-t border-border hover:bg-muted/40 transition-colors group">
      <td className="px-4 py-2">
        <div className="font-medium text-sm">{displayName}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {user.email}
        </div>
      </td>

      {roles.map((role) => {
        const hasRole = user.roles.includes(role);
        const isThisRoleUpdating =
          isUserUpdating && updatingRole === role;

        return (
          <td key={role} className="px-2 py-2 text-center">
            <Checkbox
              checked={hasRole}
              onCheckedChange={(checked) =>
                onRoleChange(user.id, role, checked === true)
              }
              disabled={isThisRoleUpdating}
              className={cn(isThisRoleUpdating && "opacity-50")}
            />

            {isThisRoleUpdating && (
              <Loader2 className="w-3 h-3 animate-spin inline-block ml-1" />
            )}
          </td>
        );
      })}
    </tr>
  );
}

/* =======================
   Filters
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
          placeholder={t("users.search") || "Поиск..."}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-8"
        />

        {searchTerm && (
          <button onClick={() => onSearchChange("")}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-full sm:w-48">
          <Filter className="w-4 h-4 mr-2" />
          <SelectValue placeholder={t("users.filterByRole")} />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="all">
            {t("users.allRoles")}
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
   Stats
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
        counts[r]++;
      }
    }

    return counts;
  }, [users]);

  return (
    <div className="flex flex-wrap gap-3 mb-4 text-sm">
      <Badge variant="secondary">
        {t("users.totalUsers")}: {users.length}
      </Badge>

      {roles.map((role) =>
        roleCounts[role] > 0 ? (
          <Badge key={role} variant="outline">
            {t(`roles.${role}`)}: {roleCounts[role]}
          </Badge>
        ) : null
      )}
    </div>
  );
}

/* =======================
   Main
======================= */

function UsersAdmin() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    select: (data): User[] => data.map(mapUser),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(t("users.roleUpdated"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Ошибка при обновлении роли"
      );
    },
  });

  const filteredUsers = useMemo(() => {
    if (!data) return [];

    return data.filter((u) => {
      const matchSearch =
        !searchTerm ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole =
        roleFilter === "all" ||
        u.roles.includes(roleFilter as Role);

      return matchSearch && matchRole;
    });
  }, [data, searchTerm, roleFilter]);

  const handleRoleChange = useCallback(
    (userId: string, role: Role, enabled: boolean) => {
      roleMutation.mutate({ userId, role, enabled });
    },
    [roleMutation]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("nav.users")} />
        <PageBody>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </PageBody>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t("nav.users")} />
        <PageBody>
          <div className="text-destructive">
            {error instanceof Error ? error.message : "Error"}
          </div>
        </PageBody>
      </>
    );
  }

  const users = data ?? [];

  return (
    <>
      <PageHeader title={t("nav.users")} />
      <PageBody>
        <div className="space-y-4">
          <UserFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            roles={ROLES}
          />

          <UsersStats users={users} roles={ROLES} />

          <table className="w-full">
            <thead>
              <tr>
                <th>{t("users.user")}</th>
                {ROLES.map((r) => (
                  <th key={r}>
                    {t(`roles.${r}`)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  roles={ROLES}
                  onRoleChange={handleRoleChange}
                  isUpdating={roleMutation.isPending}
                  updatingUserId={
                    roleMutation.variables?.userId ?? null
                  }
                  updatingRole={
                    roleMutation.variables?.role ?? null
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}