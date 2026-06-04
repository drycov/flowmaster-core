import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getDocument, addComment, addSignature, updateDocumentStatus,
} from "@/lib/api/documents.functions";
import { listWorkflows, startWorkflow } from "@/lib/api/workflows.functions";
import { PageHeader, PageBody } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { useI18n, localized } from "@/lib/i18n";
import { fmtDate, fmtDateShort } from "@/lib/format";
import { toast } from "sonner";
import { signCMS } from "@/lib/ncalayer";
import { supabase } from "@/integrations/supabase/client";
import {
  GitBranch, MessageSquare, History, Shield, FileSearch, Send, FileEdit, Archive,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: DocumentDetail,
});

function DocumentDetail() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, refetch } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument({ data: { id } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`doc:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `id=eq.${id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "document_comments", filter: `document_id=eq.${id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_events", filter: `document_id=eq.${id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, refetch]);

  const [comment, setComment] = useState("");
  const [wfDialog, setWfDialog] = useState(false);
  const [chosenWf, setChosenWf] = useState("");

  const { data: wfs } = useQuery({ queryKey: ["wfs-pub"], queryFn: () => listWorkflows() });

  const addCmt = useMutation({
    mutationFn: () => addComment({ data: { document_id: id, body: comment } }),
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["document", id] }); },
  });

  const startWf = useMutation({
    mutationFn: () => startWorkflow({ data: { workflow_id: chosenWf, document_id: id } }),
    onSuccess: () => {
      toast.success("Маршрут запущен");
      setWfDialog(false);
      qc.invalidateQueries({ queryKey: ["document", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const archive = useMutation({
    mutationFn: () => updateDocumentStatus({ data: { id, status: "archived" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document", id] }),
  });

  const handleSign = async () => {
    try {
      const payload = data?.document ? btoa(unescape(encodeURIComponent(data.document.body || data.document.title_ru || ""))) : "";
      const r = await signCMS(payload);
      await addSignature({ data: { document_id: id, payload: r.signature, signature_type: "CMS" } });
      toast.success("Подпись добавлена");
      qc.invalidateQueries({ queryKey: ["document", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("ncalayer.notFound"));
    }
  };

  if (!data?.document) return <PageBody>{t("common.loading")}</PageBody>;
  const doc = data.document;

  return (
    <>
      <PageHeader
        title={localized(doc, locale, "title")}
        description={`${t("doc.regNumber")}: ${doc.reg_number}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/documents" })}>{t("common.back")}</Button>
            <Dialog open={wfDialog} onOpenChange={setWfDialog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><GitBranch className="w-4 h-4 mr-1" />{t("doc.start_workflow")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("doc.start_workflow")}</DialogTitle></DialogHeader>
                <Select value={chosenWf} onValueChange={setChosenWf}>
                  <SelectTrigger><SelectValue placeholder="Выберите маршрут..." /></SelectTrigger>
                  <SelectContent>
                    {(wfs ?? []).filter((w) => w.status === "published").map((w) => (
                      <SelectItem key={w.id} value={w.id}>{localized(w, locale, "name")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button onClick={() => startWf.mutate()} disabled={!chosenWf || startWf.isPending}>{t("common.submit")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={handleSign}><Shield className="w-4 h-4 mr-1" />{t("ncalayer.sign")}</Button>
            <Button size="sm" variant="outline" onClick={() => archive.mutate()}><Archive className="w-4 h-4 mr-1" />{t("common.archive")}</Button>
          </>
        }
      />
      <PageBody className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <Tabs defaultValue="content">
            <TabsList className="rounded-sm">
              <TabsTrigger value="content"><FileEdit className="w-4 h-4 mr-1" />{t("doc.body")}</TabsTrigger>
              <TabsTrigger value="office"><FileSearch className="w-4 h-4 mr-1" />Office Web</TabsTrigger>
              <TabsTrigger value="versions"><History className="w-4 h-4 mr-1" />{t("doc.versions")}</TabsTrigger>
              <TabsTrigger value="comments"><MessageSquare className="w-4 h-4 mr-1" />{t("doc.comments")}</TabsTrigger>
              <TabsTrigger value="audit"><Shield className="w-4 h-4 mr-1" />{t("doc.audit")}</TabsTrigger>
            </TabsList>

            <TabsContent value="content">
              <Card className="rounded-sm"><CardContent className="p-6 prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm">
                {doc.summary && <p className="text-muted-foreground italic">{doc.summary}</p>}
                {doc.body || <span className="text-muted-foreground">{t("common.empty")}</span>}
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="office">
              <Card className="rounded-sm"><CardContent className="p-6">
                <OfficeEditor documentId={id} />
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="versions">
              <Card className="rounded-sm"><CardContent className="p-0">
                <table className="w-full data-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-2 w-20">#</th>
                      <th className="text-left px-4 py-2">{t("common.comment")}</th>
                      <th className="text-left px-4 py-2 w-40">{t("common.date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.versions.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">{t("common.empty")}</td></tr>
                    ) : data.versions.map((v) => (
                      <tr key={v.id} className="border-t border-border">
                        <td className="px-4 py-2 font-mono">v{v.version_no}</td>
                        <td className="px-4 py-2">{v.comment || "—"}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(v.created_at, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="comments">
              <Card className="rounded-sm"><CardContent className="p-4 space-y-3">
                {data.comments.length === 0 && <div className="text-sm text-muted-foreground">{t("common.empty")}</div>}
                {data.comments.map((c) => (
                  <div key={c.id} className="border-l-2 border-primary/50 pl-3 py-1">
                    <div className="text-xs text-muted-foreground">{fmtDate(c.created_at, locale)}</div>
                    <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                  </div>
                ))}
                <div className="pt-3 border-t border-border space-y-2">
                  <Textarea rows={3} placeholder={t("doc.add_comment")} value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Button size="sm" onClick={() => addCmt.mutate()} disabled={!comment.trim() || addCmt.isPending}>
                    <Send className="w-4 h-4 mr-1" />{t("common.submit")}
                  </Button>
                </div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card className="rounded-sm"><CardContent className="p-0">
                <table className="w-full data-table">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2 w-40">{t("common.date")}</th>
                    <th className="text-left px-4 py-2">Событие</th>
                  </tr></thead>
                  <tbody>
                    {data.events.length === 0 && <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">{t("common.empty")}</td></tr>}
                    {data.events.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-4 py-2 text-xs text-muted-foreground font-mono">{fmtDate(e.created_at, locale)}</td>
                        <td className="px-4 py-2 text-sm">{e.event_type} <span className="text-xs text-muted-foreground">· {e.node_id ?? ""}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="rounded-sm">
            <CardHeader><CardTitle className="text-sm">{t("doc.metadata")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label={t("common.status")}><StatusBadge status={doc.status} /></Field>
              <Field label="SLA"><SlaBadge sla={doc.sla_status} /></Field>
              <Field label={t("common.type")}>{doc.doc_type}</Field>
              <Field label={t("common.deadline")}>{doc.due_at ? fmtDateShort(doc.due_at, locale) : "—"}</Field>
              <Field label={t("common.version")}>v{doc.current_version}</Field>
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader><CardTitle className="text-sm">{t("doc.workflow")}</CardTitle></CardHeader>
            <CardContent>
              {data.runs.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("common.empty")}</div>
              ) : (
                <div className="space-y-2">
                  {data.runs.map((r) => (
                    <div key={r.id} className="border border-border rounded-sm p-2">
                      <div className="text-xs font-mono text-muted-foreground">{r.status}</div>
                      <div className="text-sm">{(r as { workflows: { name_ru: string; name_kk: string } | null }).workflows ? localized((r as { workflows: { name_ru: string; name_kk: string } }).workflows, locale, "name") : ""}</div>
                      <div className="text-xs text-muted-foreground">Текущий узел: {r.current_node ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm">
            <CardHeader><CardTitle className="text-sm">{t("doc.signatures")}</CardTitle></CardHeader>
            <CardContent>
              {data.signatures.length === 0 ? (
                <div className="text-sm text-muted-foreground">Подписей нет</div>
              ) : (
                <div className="space-y-2">
                  {data.signatures.map((s) => (
                    <div key={s.id} className="border border-border rounded-sm p-2 text-xs">
                      <div className="font-mono">{s.signature_type}</div>
                      <div className="text-muted-foreground">{s.cert_subject || "—"}</div>
                      <div className="text-muted-foreground">{s.signed_at ? fmtDate(s.signed_at, locale) : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function OfficeEditor({ documentId }: { documentId: string }) {
  const officeUrl = (import.meta.env.VITE_OFFICE_URL as string | undefined) || "";
  const { t } = useI18n();
  if (!officeUrl) {
    return (
      <div className="border-2 border-dashed border-border rounded-sm p-12 text-center text-sm text-muted-foreground space-y-2">
        <FileEdit className="w-8 h-8 mx-auto opacity-50" />
        <div className="font-medium text-foreground">ONLYOFFICE / MS Office Web</div>
        <p>{t("office.placeholder")}</p>
        <p className="text-xs font-mono">document_id = {documentId}</p>
      </div>
    );
  }
  return <iframe src={`${officeUrl}?doc=${documentId}`} className="w-full h-[600px] border border-border rounded-sm" />;
}
