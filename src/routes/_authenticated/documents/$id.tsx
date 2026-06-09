import { useDocumentActions } from "@/components/document-detail/hooks/useDocumentActions";
import { useDocumentData } from "@/components/document-detail/hooks/useDocumentData";
import { useRealtimeUpdates } from "@/components/document-detail/hooks/useRealtimeUpdates";
import { getMyProfile } from "@/lib/api/admin.functions";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

// Компоненты разметки и UI
import { PageBody, PageHeader } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// Изолированные компоненты деталки
import { AuditTab } from "@/components/document-detail/components/AuditTab";
import { ContentTab } from "@/components/document-detail/components/ContentTab";
import { SignaturesCard } from "@/components/document-detail/components/SignaturesCard";
import { SlaBadgeSafe } from "@/components/document-detail/components/SlaBadgeSafe";
import { VersionsTab } from "@/components/document-detail/components/VersionsTab";
import { WorkflowActions } from "@/components/document-detail/components/WorkflowActions";
import { WorkflowCard } from "@/components/document-detail/components/WorkflowCard";
// Инструменты и Иконки
import { fmtDate, fmtDateShort } from "@/lib/format";
import { localized, useI18n } from "@/i18n";
import {
  correspondentLabel,
  documentTypeLabel,
  priorityLabel,
} from "@/lib/documents/reference-display";
import { findMyPendingTask } from "@/lib/workflow/task-match";
import {
  Archive,
  FileEdit,
  FileSearch,
  GitBranch,
  History,
  MessageSquare,
  Send,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: DocumentDetail,
});

function DocumentDetail() {
  const { id } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  // 1. Используем централизованный хук для получения и парсинга данных
  const { data, refetch, isLoading } = useDocumentData(id);

  // 2. Подключаем Realtime-обновления Supabase
  useRealtimeUpdates(id, refetch);

  // 3. Используем хук действий над документом
  const {
    workflows,
    addComment,
    isAddingComment,
    startWorkflow,
    isStartingWorkflow,
    // archiveDocument, 
    archive: archiveDocument,
  } = useDocumentActions(id);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });

  const [comment, setComment] = useState("");
  const [wfDialog, setWfDialog] = useState(false);
  const [chosenWf, setChosenWf] = useState("");

  if (isLoading || !data?.document) {
    return <PageBody>{t("common.loading")}</PageBody>;
  }

  const doc = data.document;

  const currentVersion =
    data.versions.find((v) => v.version_no === doc.current_version) ?? data.versions[0] ?? null;

  const hasActiveRun = (data?.runs ?? []).some((r) => r.status === "running");
  const myPendingTask = findMyPendingTask(data.tasks ?? [], me?.profile?.id, {
    isAdmin: me?.roles?.includes("admin"),
  });

  const handleStartWorkflow = () => {
    startWorkflow(chosenWf || undefined, {
      onSuccess: () => {
        setWfDialog(false);
        setChosenWf("");
      },
    });
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    addComment(comment, {
      onSuccess: () => setComment(""),
    });
  };

  return (
    <>
      <PageHeader
        title={localized(doc, locale, "title")}
        description={`${t("doc.regNumber")}: ${doc.reg_number}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/documents" })}>
              {t("common.back")}
            </Button>

            {/* Диалог запуска маршрута */}
            {!hasActiveRun && (
              <Dialog open={wfDialog} onOpenChange={setWfDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <GitBranch className="w-4 h-4 mr-1" />
                    {t("doc.start_workflow")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("doc.start_workflow")}</DialogTitle>
                  </DialogHeader>
                  <p className="text-xs text-muted-foreground mb-2">
                    {doc.workflow_id || doc.custom_route
                      ? t("doc.routeSavedHint")
                      : t("doc.routeSelectHint")}
                  </p>
                  <Select value={chosenWf} onValueChange={setChosenWf}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("doc.selectRouteOptional")} />
                    </SelectTrigger>
                    <SelectContent>
                      {workflows.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {localized(w, locale, "name")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DialogFooter>
                    <Button onClick={handleStartWorkflow} disabled={isStartingWorkflow}>
                      {t("common.submit")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Кнопка архивации */}
            <Button size="sm" variant="outline" onClick={() => archiveDocument()}>
              <Archive className="w-4 h-4 mr-1" />
              {t("common.archive")}
            </Button>
          </>
        }
      />

      <PageBody className="grid grid-cols-3 gap-4">
        {/* Левая сторона: Вкладки с содержимым и мета-данными */}
        <div className="col-span-2 space-y-4">
          <Tabs defaultValue="content">
            <TabsList className="rounded-sm">
              <TabsTrigger value="content"><FileEdit className="w-4 h-4 mr-1" />{t("doc.body")}</TabsTrigger>
              <TabsTrigger value="office"><FileSearch className="w-4 h-4 mr-1" />Office Web</TabsTrigger>
              <TabsTrigger value="versions"><History className="w-4 h-4 mr-1" />{t("doc.versions")}</TabsTrigger>
              <TabsTrigger value="comments"><MessageSquare className="w-4 h-4 mr-1" />{t("doc.comments")}</TabsTrigger>
              <TabsTrigger value="audit"><Shield className="w-4 h-4 mr-1" />{t("doc.audit")}</TabsTrigger>
            </TabsList>

            {/* Вкладка 1: Скомпилированное содержание документа (решает проблему тегов) */}
            <TabsContent value="content">
              <ContentTab
                body={doc.body}
                fieldValues={data.documentFields}
                currentVersion={currentVersion}
                summary={doc.summary}
                isEditable={doc.status === "draft"}
              />
            </TabsContent>

            {/* Вкладка 2: Интеграция с редактором документов (ONLYOFFICE/MS Web) */}
            <TabsContent value="office">
              <Card className="rounded-sm">
                <CardContent className="p-6">
                  <OfficeEditor documentId={id} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Вкладка 3: Журнал версий файла */}
            <TabsContent value="versions">
              <VersionsTab
                documentId={id}
                versions={data.versions}
                canUpload={doc.status === "draft" || doc.status === "in_review"}
              />
            </TabsContent>

            {/* Вкладка 4: Секция комментариев */}
            <TabsContent value="comments">
              <Card className="rounded-sm">
                <CardContent className="p-4 space-y-3">
                  {data.comments.length === 0 && (
                    <div className="text-sm text-muted-foreground">{t("common.empty")}</div>
                  )}
                  {data.comments.map((c) => (
                    <div key={c.id} className="border-l-2 border-primary/50 pl-3 py-1">
                      <div className="text-xs text-muted-foreground">{fmtDate(c.created_at, locale)}</div>
                      <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border space-y-2">
                    <Textarea
                      rows={3}
                      placeholder={t("doc.add_comment")}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!comment.trim() || isAddingComment}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {t("common.submit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Вкладка 5: Аудит системы (Логи) */}
            <TabsContent value="audit">
              <AuditTab events={data.events} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Правая сторона: Боковая панель (Задачи, Метаданные, Маршруты, Подписи) */}
        <div className="space-y-4">
          {myPendingTask && (
            <WorkflowActions
              documentId={id}
              tasks={data.tasks ?? []}
              currentUserId={me?.profile?.id}
              isAdmin={me?.roles?.includes("admin")}
              signPayload={doc.body ?? doc.title_ru ?? id}
            />
          )}

          {/* Карточка системных метаданных документа */}
          <Card className="rounded-sm">
            <CardHeader><CardTitle className="text-sm">{t("doc.metadata")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label={t("common.status")}><StatusBadge status={doc.status} /></Field>
              <Field label="SLA"><SlaBadgeSafe sla={doc.sla_status} /></Field>
              <Field label={t("doc.documentType")}>{documentTypeLabel(doc, locale)}</Field>
              <Field label={t("doc.priority")}>{priorityLabel(doc, locale)}</Field>
              <Field label={t("doc.correspondent")}>{correspondentLabel(doc, locale)}</Field>
              <Field label={t("common.deadline")}>{doc.due_at ? fmtDateShort(doc.due_at, locale) : "—"}</Field>
              <Field label={t("common.version")}>v{doc.current_version}</Field>
            </CardContent>
          </Card>

          {/* Вынесенный компонент активных маршрутов согласования */}
          <WorkflowCard
            runs={data.runs}
            tasks={data.tasks ?? []}
            customRoute={doc.custom_route}
            workflowDefinition={doc.workflows?.definition}
            workflowName={doc.workflows ? localized(doc.workflows, locale, "name") : null}
          />

          {/* Вынесенный компонент цифровых подписей (CMS/ЭЦП) */}
          <SignaturesCard signatures={data.signatures} />
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