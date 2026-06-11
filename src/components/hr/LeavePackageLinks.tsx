import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileStack, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { getLeaveRequestDocuments } from "@/lib/api/hr.functions";

const KIND_LABEL: Record<string, string> = {
  application: "hr.leave.package.kind.application",
  approval_sheet: "hr.leave.package.kind.approvalSheet",
  order: "hr.leave.package.kind.order",
  memo: "hr.leave.package.kind.memo",
};

export function LeavePackageLinks({ leaveRequestId }: { leaveRequestId: string }) {
  const { t } = useI18n();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["leave-request-documents", leaveRequestId],
    queryFn: () => getLeaveRequestDocuments({ data: { leave_request_id: leaveRequestId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("hr.leave.package.loading")}
      </div>
    );
  }

  if (!docs.length) return null;

  return (
    <div className="mt-3 space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileStack className="h-4 w-4" />
        {t("hr.leave.package.title")}
      </div>
      <ul className="space-y-1.5">
        {docs.map((raw) => {
          const row = raw as {
            doc_kind: string;
            documents?: {
              id: string;
              reg_number?: string;
              title_ru?: string;
              status?: string;
            } | null;
          };
          const doc = row.documents;
          if (!doc) return null;
          const kindKey = KIND_LABEL[row.doc_kind];
          return (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {kindKey ? t(kindKey as "hr.leave.package.kind.application") : row.doc_kind}
              </span>
              <div className="flex items-center gap-2">
                {doc.status ? (
                  <Badge variant="outline" className="text-xs">
                    {doc.status}
                  </Badge>
                ) : null}
                <Link
                  to="/documents/$id"
                  params={{ id: doc.id }}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {doc.reg_number || doc.title_ru || doc.id.slice(0, 8)}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
