import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { publishDocumentToKb, listKbArticles } from "@/lib/api/kb.functions";
import { toast } from "sonner";

export function KbPublishCard({
  documentId,
  documentStatus,
}: {
  documentId: string;
  documentStatus: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const canPublish = ["approved", "signed", "archived"].includes(documentStatus);

  const { data: articles = [] } = useQuery({
    queryKey: ["kb-by-doc", documentId],
    queryFn: () =>
      listKbArticles({ data: { status: "published", limit: 200 } }).then((rows) =>
        rows.filter((a) => a.source_document_id === documentId),
      ),
  });

  const publishMut = useMutation({
    mutationFn: () => publishDocumentToKb({ data: { document_id: documentId } }),
    onSuccess: (row) => {
      toast.success(t("kb.published"));
      qc.invalidateQueries({ queryKey: ["kb-by-doc", documentId] });
      qc.invalidateQueries({ queryKey: ["kb-articles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("kb.error")),
  });

  const linked = articles[0] as { id: string } | undefined;

  if (!canPublish && !linked) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          {t("kb.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {linked ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/knowledge/$id" params={{ id: linked.id }}>
              {t("kb.viewArticle")}
            </Link>
          </Button>
        ) : canPublish ? (
          <Button size="sm" onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
            {t("kb.publishFromDoc")}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{t("kb.publishHint")}</p>
        )}
      </CardContent>
    </Card>
  );
}
