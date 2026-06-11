import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import type { ReferenceBriefRow } from "@/lib/api/reference-types";
import { Plus, Trash2, Link2 } from "lucide-react";
import { useI18n, localized } from "@/i18n";
import { listDocuments, type DocumentListRowEnriched } from "@/lib/api/documents.functions";
import {
  createDocumentLink,
  deleteDocumentLink,
  listDocumentLinks,
} from "@/lib/api/document-links.functions";
import { listDocumentLinkTypesBrief } from "@/lib/api/references.functions";
import { toast } from "sonner";

type LinkedDoc = {
  id: string;
  reg_number: string;
  title_ru: string;
  title_kk?: string | null;
  status: string;
};

type LinkRow = {
  id: string;
  note?: string | null;
  created_at: string;
  link_type?: { id: string; code: string; name_ru: string; name_kk: string } | null;
  target?: LinkedDoc | null;
  source?: LinkedDoc | null;
};

interface DocumentLinksTabProps {
  documentId: string;
  canEdit?: boolean;
}

export function DocumentLinksTab({ documentId, canEdit = false }: DocumentLinksTabProps) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [linkTypeId, setLinkTypeId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["document-links", documentId],
    queryFn: () => listDocumentLinks({ data: { document_id: documentId } }),
  });

  const { data: linkTypes = [] } = useQuery<ReferenceBriefRow[]>({
    queryKey: ["ref-document-link-types"],
    queryFn: listDocumentLinkTypesBrief,
    enabled: dialogOpen,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["doc-link-search", search],
    queryFn: () => listDocuments({ data: { search, limit: 20 } }),
    enabled: dialogOpen && search.trim().length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createDocumentLink({
        data: {
          source_document_id: documentId,
          target_document_id: targetId,
          link_type_id: linkTypeId,
          note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-links", documentId] });
      toast.success(t("doc.links.created"));
      setDialogOpen(false);
      setSearch("");
      setTargetId("");
      setNote("");
      setLinkTypeId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("doc.links.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocumentLink({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-links", documentId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("doc.links.error")),
  });

  const unwrap = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  const outgoing = ((data?.outgoing ?? []) as LinkRow[]).map((row) => ({
    ...row,
    link_type: unwrap(row.link_type),
    target: unwrap(row.target),
  }));
  const incoming = ((data?.incoming ?? []) as LinkRow[]).map((row) => ({
    ...row,
    link_type: unwrap(row.link_type),
    source: unwrap(row.source),
  }));
  const candidates = (searchResults as DocumentListRowEnriched[]).filter(
    (d) => d.id !== documentId,
  );

  const resetDialog = () => {
    setSearch("");
    setTargetId("");
    setNote("");
    setLinkTypeId("");
  };

  return (
    <Card className="rounded-sm">
      <CardContent className="p-4 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            {t("doc.links")}
          </h3>
          {canEdit && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetDialog();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  {t("doc.links.add")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("doc.links.add")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t("doc.links.type")}</Label>
                    <Select
                      value={linkTypeId || "none"}
                      onValueChange={(v) => setLinkTypeId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {linkTypes.map((lt) => (
                          <SelectItem key={lt.id} value={lt.id}>
                            {localized(lt, locale, "name")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("doc.links.searchDoc")}</Label>
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setTargetId("");
                      }}
                      placeholder={t("common.search")}
                    />
                    {search.trim().length >= 2 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-sm">
                        {candidates.length === 0 ? (
                          <p className="p-2 text-xs text-muted-foreground">
                            {t("search.noResults")}
                          </p>
                        ) : (
                          candidates.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
                                targetId === d.id ? "bg-muted" : ""
                              }`}
                              onClick={() => setTargetId(d.id)}
                            >
                              <span className="font-mono text-xs text-muted-foreground">
                                {d.reg_number}
                              </span>
                              <span className="ml-2">{localized(d, locale, "title")}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>{t("doc.links.note")}</Label>
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!linkTypeId || !targetId || createMutation.isPending}
                  >
                    {t("common.submit")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}

        {!isLoading && outgoing.length === 0 && incoming.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("doc.links.empty")}</p>
        )}

        {outgoing.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("doc.links.outgoing")}
            </h4>
            {outgoing.map((row) => (
              <LinkItem
                key={row.id}
                row={row}
                doc={row.target}
                locale={locale}
                canEdit={canEdit}
                onDelete={() => deleteMutation.mutate(row.id)}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </section>
        )}

        {incoming.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("doc.links.incoming")}
            </h4>
            {incoming.map((row) => (
              <LinkItem
                key={row.id}
                row={row}
                doc={row.source}
                locale={locale}
                canEdit={canEdit}
                onDelete={() => deleteMutation.mutate(row.id)}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function LinkItem({
  row,
  doc,
  locale,
  canEdit,
  onDelete,
  isDeleting,
}: {
  row: LinkRow;
  doc?: LinkedDoc | null;
  locale: "ru" | "kk";
  canEdit: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useI18n();
  if (!doc) return null;

  return (
    <div className="flex items-start justify-between gap-2 border border-border rounded-sm px-3 py-2">
      <div className="min-w-0 space-y-1">
        <div className="text-xs text-muted-foreground">
          {row.link_type ? localized(row.link_type, locale, "name") : "—"}
        </div>
        <Link
          to="/documents/$id"
          params={{ id: doc.id }}
          className="text-sm font-medium text-primary hover:underline truncate block"
        >
          <span className="font-mono text-xs text-muted-foreground mr-2">{doc.reg_number}</span>
          {localized(doc, locale, "title")}
        </Link>
        {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
        <StatusBadge status={doc.status} />
      </div>
      {canEdit && (
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
