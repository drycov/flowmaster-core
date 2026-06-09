import { Badge } from "@/components/ui/badge";
import { Role } from "../domain/roles";
import { useMemo } from "react";

export function UsersStats({ users, roles, t }: any) {
  const counts = useMemo(() => {
    const c: Record<Role, number> = {
      admin: 0,
      registrar: 0,
      approver: 0,
      signer: 0,
      archivist: 0,
      viewer: 0,
    };

    for (const u of users) {
      for (const r of u.roles) {
        if (r in c) c[r as Role]++;
      }
    }

    return c;
  }, [users]);

  return (
    <div className="flex gap-2">
      <Badge>
        {t("users.totalUsers")}: {users.length}
      </Badge>

      {roles.map((r: Role) =>
        counts[r] ? (
          <Badge key={r} variant="outline">
            {r}: {counts[r]}
          </Badge>
        ) : null,
      )}
    </div>
  );
}
