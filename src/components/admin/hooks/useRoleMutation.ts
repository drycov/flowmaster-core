import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setUserRole } from "@/lib/api/admin.functions";
import { Role } from "../domain/roles";
import { User } from "../domain/types";

export function useRoleMutation(
  setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>,
  t: (k: string) => string
) {
  const queryClient = useQueryClient();

  return useMutation({
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
        old?.map((u) =>
          u.id !== userId
            ? u
            : {
                ...u,
                roles: enabled
                  ? [...u.roles, role]
                  : u.roles.filter((r) => r !== role),
              }
        )
      );

      setSelectedUser((current) =>
        current?.id === userId
          ? {
              ...current,
              roles: enabled
                ? [...current.roles, role]
                : current.roles.filter((r) => r !== role),
            }
          : current
      );

      return { previousUsers };
    },

    onError: (err, vars, ctx) => {
      if (ctx?.previousUsers) {
        queryClient.setQueryData(["users"], ctx.previousUsers);

        const original = ctx.previousUsers.find(
          (u) => u.id === vars.userId
        );

        if (original) setSelectedUser(original);
      }
    },

    onSuccess: () => {
      // toast лучше держать на уровне UI слоя
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}