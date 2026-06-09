import { useQuery } from "@tanstack/react-query";
import { listUsers } from "@/lib/api/admin.functions";
import { mapUser } from "../domain/mapper";
import { User } from "../domain/types";

export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    select: (raw): User[] => raw.map(mapUser),
    staleTime: 30_000,
  });
}
