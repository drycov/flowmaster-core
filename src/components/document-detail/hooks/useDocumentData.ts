import { useQuery } from "@tanstack/react-query";
import { getDocument } from "@/lib/api/documents.functions";
import type { DocumentData } from "../types";

export function useDocumentData(id: string) {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument({ data: { id } }),
  });

  return {
    data: data as DocumentData | undefined,
    refetch,
    isLoading,
  };
}