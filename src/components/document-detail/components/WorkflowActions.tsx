import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";

import { Check, X, Undo2, Loader2, MessageSquare, LockKeyhole } from "lucide-react";

import { toast } from "sonner";

import { advanceWorkflowTask } from "@/lib/api/workflows.functions";

import { addSignature } from "@/lib/api/documents.functions";

import { findMyPendingTask, type WorkflowTaskRow } from "@/lib/workflow/task-match";

import { signCMSFull, NCALayerError } from "@/lib/ncalayer";

import { useI18n } from "@/i18n";
import { useLicenseStatus } from "@/lib/license/hooks";

import { ncalayerErrorMessage } from "@/i18n/ncalayer-messages";



interface Props {

  documentId: string;

  tasks: WorkflowTaskRow[];

  currentUserId?: string;

  isAdmin?: boolean;

  signPayload?: string;

}



type DecisionType = "approve" | "reject" | "return";



function toSignPayload(text?: string) {

  if (!text) return "";

  return btoa(unescape(encodeURIComponent(text)));

}



export function WorkflowActions({

  documentId,

  tasks,

  currentUserId,

  isAdmin = false,

  signPayload,

}: Props) {

  const { t } = useI18n();
  const { isWritable, can: licenseCan } = useLicenseStatus();

  const qc = useQueryClient();

  const [comment, setComment] = useState("");



  const myTask = findMyPendingTask(tasks ?? [], currentUserId, { isAdmin });



  const isSignTask = myTask?.action_required === "sign";



  const mutation = useMutation({

    mutationFn: (decision: DecisionType) => {

      if (!myTask) {

        return Promise.reject(new Error(t("doc.action.noTask")));

      }



      const cleanComment = comment.trim();

      if ((decision === "reject" || decision === "return") && !cleanComment) {

        return Promise.reject(new Error(t("doc.action.commentRequired")));

      }



      return advanceWorkflowTask({

        data: {

          task_id: myTask.id,

          decision,

          comment: cleanComment || null,

        },

      });

    },

    onSuccess: (_, decision) => {

      const messages: Record<DecisionType, string> = {

        approve: t("doc.action.approved"),

        return: t("doc.action.returned"),

        reject: t("doc.action.rejected"),

      };



      toast.success(messages[decision]);

      setComment("");

      qc.invalidateQueries({ queryKey: ["document", documentId] });
      qc.invalidateQueries({ queryKey: ["myTasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

    },

    onError: (e) => {

      toast.error(e instanceof Error ? e.message : t("doc.action.error"));

    },

  });



  const signMutation = useMutation({

    mutationFn: async () => {

      if (!myTask) throw new Error(t("doc.action.noTask"));



      const payload = toSignPayload(signPayload || documentId);

      const result = await signCMSFull(payload);



      await addSignature({

        data: {

          document_id: documentId,

          payload: result.signature,

          signature_type: "CMS",

          cert_subject: result.certInfo.subject ?? null,

          cert_serial: result.certInfo.serial ?? null,

          cert_issuer: result.certInfo.issuer ?? null,

          workflow_task_id: myTask.id,

        },

      });

    },

    onSuccess: () => {

      toast.success(t("doc.action.signed"));

      setComment("");

      qc.invalidateQueries({ queryKey: ["document", documentId] });
      qc.invalidateQueries({ queryKey: ["myTasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

    },

    onError: (e) => {

      if (e instanceof NCALayerError) {

        toast.error(ncalayerErrorMessage(t, e));

      } else {

        toast.error(e instanceof Error ? e.message : t("doc.action.error"));

      }

    },

  });



  if (!myTask) return null;

  const workflowAllowed = isWritable && licenseCan("workflows");
  const signAllowed = isWritable && licenseCan("eds_signing");
  const actionBlocked = isSignTask ? !signAllowed : !workflowAllowed;

  const isPending = mutation.isPending || signMutation.isPending;

  const isCommentEmpty = !comment.trim();



  if (isSignTask) {

    return (

      <Card className="rounded-sm border-primary/40 shadow-sm bg-gradient-to-b from-background to-muted/10">

        <CardHeader className="pb-2">

          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">

            <LockKeyhole className="w-4 h-4 text-primary" />

            {t("doc.action.signEds")}

          </CardTitle>

        </CardHeader>

        <CardContent className="space-y-3">

          <div className="text-xs text-muted-foreground bg-background p-2 rounded border border-border/60">

            {t("doc.currentStage")}{" "}

            <span className="text-foreground font-semibold">{myTask.title ?? myTask.node_id}</span>

          </div>

          <p className="text-xs text-muted-foreground">

            {t("ncalayer.title")}

          </p>

          {actionBlocked ? (
            <p className="text-xs text-destructive">{t("license.banner.readOnly")}</p>
          ) : null}

          <Button

            size="sm"

            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"

            disabled={isPending || actionBlocked}

            onClick={() => signMutation.mutate()}

          >

            {signMutation.isPending ? (

              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />

            ) : (

              <LockKeyhole className="w-4 h-4 mr-1" />

            )}

            {t("ncalayer.sign")}

          </Button>

        </CardContent>

      </Card>

    );

  }



  return (

    <Card className="rounded-sm border-primary/40 shadow-sm bg-gradient-to-b from-background to-muted/10">

      <CardHeader className="pb-2">

        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">

          <MessageSquare className="w-4 h-4 text-primary" />

          {t("common.actions")}

        </CardTitle>

      </CardHeader>

      <CardContent className="space-y-3">

        <div className="text-xs text-muted-foreground bg-background p-2 rounded border border-border/60">

          {t("doc.currentStage")}{" "}

          <span className="text-foreground font-semibold">{myTask.title ?? myTask.node_id}</span>

        </div>



        <Textarea

          placeholder={t("doc.action.commentRequired")}

          rows={3}

          value={comment}

          onChange={(e) => setComment(e.target.value)}

          disabled={isPending}

          className="resize-none focus-visible:ring-primary/50 text-sm"

        />

        {actionBlocked ? (
          <p className="text-xs text-destructive">{t("license.banner.readOnly")}</p>
        ) : null}

        <div className="grid grid-cols-3 gap-2">

          <Button

            size="sm"

            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"

            disabled={isPending || actionBlocked}

            onClick={() => mutation.mutate("approve")}

          >

            {mutation.isPending && mutation.variables === "approve" ? (

              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />

            ) : (

              <Check className="w-4 h-4 mr-1" />

            )}

            {t("doc.action.approve")}

          </Button>



          <Button

            size="sm"

            variant="outline"

            className="border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 font-medium"

            disabled={isPending || actionBlocked || isCommentEmpty}

            onClick={() => mutation.mutate("return")}

            title={isCommentEmpty ? t("doc.action.commentRequired") : ""}

          >

            {mutation.isPending && mutation.variables === "return" ? (

              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />

            ) : (

              <Undo2 className="w-4 h-4 mr-1" />

            )}

            {t("doc.action.return")}

          </Button>



          <Button

            size="sm"

            variant="destructive"

            className="font-medium"

            disabled={isPending || actionBlocked || isCommentEmpty}

            onClick={() => mutation.mutate("reject")}

            title={isCommentEmpty ? t("doc.action.commentRequired") : ""}

          >

            {mutation.isPending && mutation.variables === "reject" ? (

              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />

            ) : (

              <X className="w-4 h-4 mr-1" />

            )}

            {t("doc.action.reject")}

          </Button>

        </div>

      </CardContent>

    </Card>

  );

}
