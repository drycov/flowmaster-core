import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Role } from "../domain/roles";
import { User } from "../domain/types";
import { localized, type Locale } from "@/i18n";

export function UserRow({
  user,
  roles,
  locale,
  isUpdating,
  updatingUserId,
  updatingRole,
  onRoleChange,
  onRowClick,
}: {
  user: User;
  roles: readonly Role[];
  locale: Locale;
  isUpdating: boolean;
  updatingUserId: string | null;
  updatingRole: Role | null;
  onRoleChange: (userId: string, role: Role, enabled: boolean) => void;
  onRowClick: (user: User) => void;
}) {
  const displayName = localized(user, locale, "full_name") || "—";
  const isUserUpdating = isUpdating && updatingUserId === user.id;

  return (
    <tr onClick={() => onRowClick(user)} className="cursor-pointer">
      <td className="px-4 py-3">
        <div className="font-medium">{displayName}</div>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </td>

      {roles.map((role) => {
        const hasRole = user.roles.includes(role);
        const loading = isUserUpdating && updatingRole === role;

        return (
          <td key={role} className="text-center">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Checkbox
                checked={hasRole}
                onCheckedChange={(v) => onRoleChange(user.id, role, v === true)}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}
