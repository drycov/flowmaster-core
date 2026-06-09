import { useQuery } from "@tanstack/react-query";
import { useDocumentActions } from "@/components/document-detail/hooks/useDocumentActions";
import { OfficeTab } from "@/components/document-detail/components/OfficeTab";
import { listMySubstitutions } from "@/lib/api/substitutions.functions";
import { useDocumentData } from "@/components/document-detail/hooks/useDocumentData";
import { useRealtimeUpdates } from "@/components/document-detail/hooks/useRealtimeUpdates";
import { getMyProfile } from "@/lib/api/admin.functions";
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
import { DocumentEditSheet } from "@/components/document-detail/components/DocumentEditSheet";
import { AuditTab } from "@/components/document-detail/components/AuditTab";
import { ContentTab } from "@/components/document-detail/components/ContentTab";
import { DocumentLinksTab } from "@/components/document-detail/components/DocumentLinksTab";
import { ArchiveRetentionCard } from "@/components/document-detail/components/ArchiveRetentionCard";
import { SignaturesCard } from "@/components/document-detail/components/SignaturesCard";
import { DocumentAccessPanel } from "@/components/document-detail/components/DocumentAccessPanel";
import { DocumentAccessGrantsPanel } from "@/components/document-detail/components/DocumentAccessGrantsPanel";
import { DocumentAccessDenied } from "@/components/document-detail/components/DocumentAccessDenied";
import { DocumentQrCard } from "@/components/document-detail/components/DocumentQrCard";
import { SlaBadgeSafe } from "@/components/document-detail/components/SlaBadgeSafe";
import { VersionsTab } from "@/components/document-detail/components/VersionsTab";
import { WorkflowActions } from "@/components/document-detail/components/WorkflowActions";
import { WorkflowCard } from "@/components/document-detail/components/WorkflowCard";
// Инструменты и Иконки
import { fmtDate, fmtDateShort } from "@/lib/format";
import { localized, useI18n } from "@/i18n";
import {
  correspondentLabel,
  accessLevelLabel,
  deliveryMethodLabel,
  documentTypeLabel,
  priorityLabel,
  registrationJournalLabel,
} from "@/lib/documents/reference-display";
import { findMyPendingTask } from "@/lib/workflow/task-match";
import { SubstitutionActingBanner } from "@/components/substitution/SubstitutionActingBanner";
import { ContractDetailsCard } from "@/components/contracts/ContractDetailsCard";
import { KbPublishCard } from "@/components/kb/KbPublishCard";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  FileEdit,
  FileSearch,
  GitBranch,
  History,
  Link2,
  MessageSquare,
  Pencil,
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
    saveContent,
  } = useDocumentActions(id);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const { data: subs } = useQuery({
    queryKey: ["my-substitutions"],
    queryFn: listMySubstitutions,
  });

  const [comment, setComment] = useState("");
  const [wfDialog, setWfDialog] = useState(false);
  const [chosenWf, setChosenWf] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return <PageBody>{t("common.loading")}</PageBody>;
  }

  if ((data as { access_denied?: boolean; access?: unknown } | undefined)?.access_denied) {
    return (
      <PageBody>
        <DocumentAccessDenied
          documentId={id}
          access={(data as { access: Parameters<typeof DocumentAccessDenied>[0]["access"] }).access}
        />
      </PageBody>
    );
  }

  if (!data?.document) {
    return <PageBody>{t("errors.notFound.description")}</PageBody>;
  }

  const doc = data.document;
  const contentRestricted = !!(data as { content_restricted?: boolean }).content_restricted;

  const currentVersion =
    data.versions.find((v) => v.version_no === doc.current_version) ?? data.versions[0] ?? null;

  const hasActiveRun = (data?.runs ?? []).some((r) => r.status === "running");
  const myPendingTask = findMyPendingTask(data.tasks ?? [], me?.profile?.id, {
    isAdmin: me?.roles?.includes("admin"),
    substituteFor: subs?.actingFor ?? [],
  });

  const substitutePrincipalName =
    myPendingTask?.assignee_id &&
    myPendingTask.assignee_id !== me?.profile?.id
      ? localized(
          subs?.actingForDetails?.find((a) => a.principal_id === myPendingTask.assignee_id)
            ?.principal,
          locale,
          "full_name",
        ) || myPendingTask.assignee_id
      : undefined;

  const canEditMetadata =
    me?.roles?.includes("admin") ||
    (doc.created_by === me?.profile?.id &&
      (doc.status === "draft" || doc.status === "returned_for_revision"));

  const canManageArchive =
    me?.roles?.includes("admin") ||
    !!me?.permissions?.archive_documents ||
    !!me?.permissions?.manage_documents;

  const canReviewAccess =
    me?.roles?.includes("admin") ||
    doc.created_by === (me?.profile as { id?: string } | undefined)?.id ||
    !!me?.permissions?.manage_documents ||
    !!(data as { can_manage_access_grants?: boolean }).can_manage_access_grants;

  const docTypeCode =
    (doc as { ref_document_types?: { code?: string } }).ref_document_types?.code ?? doc.doc_type;
  const isContract = docTypeCode === "contract";
  const contractDetails = (data as { contract_details?: Parameters<typeof ContractDetailsCard>[0]["contract"] }).contract_details ?? null;
  const canEditContract =
    canEditMetadata ||
    !!me?.permissions?.manage_contracts ||
    !!me?.permissions?.manage_documents;
  const project = (doc as { document_projects?: { id: string; code: string; name_ru: string; name_kk: string } | null }).document_projects;

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

            {canEditMetadata && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-1" />
                {t("doc.edit")}
              </Button>
            )}

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
            <Button
              size="sm"
              variant="outline"
              onClick={() => archiveDocument()}
              disabled={!!doc.legal_hold}
              title={doc.legal_hold ? t("archive.legalHoldBlock") : undefined}
            >
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
              <TabsTrigger value="links"><Link2 className="w-4 h-4 mr-1" />{t("doc.links")}</TabsTrigger>
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
                isEditable={canEditMetadata}
                onSave={saveContent}
              />
            </TabsContent>

            <TabsContent value="links">
              <DocumentLinksTab documentId={id} canEdit={canEditMetadata} />
            </TabsContent>

            {/* Вкладка 2: Интеграция с редактором документов (ONLYOFFICE/MS Web) */}
            <TabsContent value="office">
              <Card className="rounded-sm">
                <CardContent className="p-6">
                  <OfficeTab
                    documentId={id}
                    initialContent={doc.body ?? ""}
                    isReadOnly={!canEditMetadata}
                    onSave={saveContent}
                  />
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
          <SubstitutionActingBanner actingFor={subs?.actingForDetails ?? []} />
          {myPendingTask && (
            <WorkflowActions
              documentId={id}
              tasks={data.tasks ?? []}
              currentUserId={me?.profile?.id}
              isAdmin={me?.roles?.includes("admin")}
              substituteFor={subs?.actingFor ?? []}
              substitutePrincipalName={substitutePrincipalName}
              signPayload={doc.body ?? doc.title_ru ?? id}
            />
          )}

          <DocumentAccessPanel documentId={id} contentRestricted={contentRestricted} />

          <DocumentAccessGrantsPanel documentId={id} canReview={canReviewAccess} />

          <ArchiveRetentionCard document={doc as never} canManage={canManageArchive} />

          <KbPublishCard documentId={id} documentStatus={doc.status} />

          {isContract && (
            <ContractDetailsCard
              documentId={id}
              contract={contractDetails}
              canEdit={canEditContract}
            />
          )}

          {/* Карточка системных метаданных документа */}
          <Card className="rounded-sm">
            <CardHeader><CardTitle className="text-sm">{t("doc.metadata")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label={t("common.status")}><StatusBadge status={doc.status} /></Field>
              <Field label="SLA"><SlaBadgeSafe sla={doc.sla_status} /></Field>
              <Field label={t("doc.documentType")}>{documentTypeLabel(doc, locale)}</Field>
              {project && (
                <Field label={t("project.title")}>
                  <Link to="/projects/$id" params={{ id: project.id }} className="text-primary hover:underline">
                    {project.code} — {localized(project, locale, "name")}
                  </Link>
                </Field>
              )}
              <Field label={t("doc.priority")}>{priorityLabel(doc, locale)}</Field>
              <Field label={t("doc.correspondent")}>{correspondentLabel(doc, locale)}</Field>
              <Field label={t("doc.registrationJournal")}>{registrationJournalLabel(doc, locale)}</Field>
              <Field label={t("doc.deliveryMethod")}>{deliveryMethodLabel(doc, locale)}</Field>
              <Field label={t("access.level")}>{accessLevelLabel(doc, locale)}</Field>
              <Field label={t("doc.externalRegNumber")}>{doc.external_reg_number || "—"}</Field>
              <Field label={t("doc.receivedAt")}>
                {doc.received_at ? fmtDateShort(doc.received_at, locale) : "—"}
              </Field>
              <Field label={t("doc.sentAt")}>
                {doc.sent_at ? fmtDateShort(doc.sent_at, locale) : "—"}
              </Field>
              <Field label={t("doc.pagesCount")}>{doc.pages_count ?? "—"}</Field>
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
          <SignaturesCard signatures={data.signatures} documentId={id} />

          <DocumentQrCard documentId={id} regNumber={doc.reg_number} />
        </div>
      </PageBody>

      <DocumentEditSheet
        document={doc}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => refetch()}
      />
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
