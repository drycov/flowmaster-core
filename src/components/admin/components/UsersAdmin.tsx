import { PageHeader, PageBody } from "@/components/AppShell";
import { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/i18n";

import { ROLES, Role } from "../domain/roles";
import type { User } from "../domain/types";
import { useUsersQuery } from "../hooks/useUsersQuery";
import { useRoleMutation } from "../hooks/useRoleMutation";

import { UserFilters } from "./UserFilters";
import { UsersStats } from "./UsersStats";
import { UserRow } from "./UserRow";
import { UserSheet } from "./UserSheet";

export function UsersAdmin() {
  const { t, locale } = useI18n();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data = [] } = useUsersQuery();

  const mutation = useRoleMutation(setSelectedUser, t);

  const filtered = useMemo(() => {
    return data.filter((u) => {
      const s = search.toLowerCase();

      return (
        (!s || u.email.toLowerCase().includes(s)) &&
        (roleFilter === "all" || u.roles.includes(roleFilter as Role))
      );
    });
  }, [data, search, roleFilter]);

  const onRoleChange = useCallback(
    (userId: string, role: Role, enabled: boolean) => {
      mutation.mutate({ userId, role, enabled });
    },
    [mutation],
  );

  return (
    <>
      <PageHeader title={t("nav.users")} />
      <PageBody>
        <UserFilters
          searchTerm={search}
          onSearchChange={setSearch}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          roles={ROLES}
        />

        <UsersStats users={data} roles={ROLES} />

        <table className="w-full">
          <tbody>
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                roles={ROLES}
                locale={locale}
                isUpdating={mutation.isPending}
                updatingUserId={mutation.variables?.userId ?? null}
                updatingRole={mutation.variables?.role ?? null}
                onRoleChange={onRoleChange}
                onRowClick={setSelectedUser}
              />
            ))}
          </tbody>
        </table>

        <UserSheet
          user={selectedUser}
          locale={locale}
          t={t}
          onClose={() => setSelectedUser(null)}
        />
      </PageBody>
    </>
  );
}
