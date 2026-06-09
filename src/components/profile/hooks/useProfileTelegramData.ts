import { useQuery } from "@tanstack/react-query";
import { getPublicAuthConfigFn } from "@/lib/api/system.functions";
import { getTelegramLinkStatus } from "@/lib/api/telegram.functions";
import type { PublicAuthConfig } from "@/components/auth/types";
import { DEFAULT_TELEGRAM_LINK_STATUS } from "../constants";

export function useProfileTelegramData() {
  const authConfigQuery = useQuery({
    queryKey: ["public-auth-config"],
    queryFn: getPublicAuthConfigFn,
    staleTime: 60_000,
  });

  const linkStatusQuery = useQuery({
    queryKey: ["telegram-link-status"],
    queryFn: getTelegramLinkStatus,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    authConfig: authConfigQuery.data as PublicAuthConfig | undefined,
    authLoading: authConfigQuery.isPending,
    linkStatus: linkStatusQuery.data ?? DEFAULT_TELEGRAM_LINK_STATUS,
    linkStatusRaw: linkStatusQuery.data,
    linkStatusLoading: linkStatusQuery.isPending,
    linkStatusError: linkStatusQuery.isError,
    linkStatusErrorObj: linkStatusQuery.error,
    refetchLinkStatus: linkStatusQuery.refetch,
  };
}
