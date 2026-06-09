import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";

import { Badge } from "@/components/ui/badge";
import { Check, X, Undo2, Loader2, MessageSquare, LockKeyhole, UserPlus, UserRoundCog } from "lucide-react";
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
import { useWorkflowTaskActions } from "@/components/tasks/useWorkflowTaskActions";
import { delegateWorkflowTask } from "@/lib/api/workflows.functions";
import { listUsersBrief } from "@/lib/api/admin.functions";
import { interpolate, localized } from "@/i18n";

import { toast } from "sonner";

import { addSignature } from "@/lib/api/documents.functions";

import { findMyPendingTask, type WorkflowTaskRow } from "@/lib/workflow/task-match";

import { signCMSFull, NCALayerError } from "@/lib/ncalayer";
import { buildSignatureInsertData } from "@/lib/eds/build-signature-record";

import { useI18n } from "@/i18n";
import { useLicenseStatus } from "@/lib/license/hooks";

import { ncalayerErrorMessage } from "@/i18n/ncalayer-messages";



interface Props {

  documentId: string;

  tasks: WorkflowTaskRow[];

  currentUserId?: string;

  isAdmin?: boolean;

  signPayload?: string;

  substituteFor?: string[];

  substitutePrincipalName?: string;

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

  substituteFor = [],

  substitutePrincipalName,

}: Props) {

  const { t, locale } = useI18n();
  const { isWritable, can: licenseCan } = useLicenseStatus();

  const qc = useQueryClient();

  const [comment, setComment] = useState("");
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateUserId, setDelegateUserId] = useState("");
  const [delegateComment, setDelegateComment] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["users-brief"],
    queryFn: listUsersBrief,
    enabled: delegateOpen,
  });

  const myTask = findMyPendingTask(tasks ?? [], currentUserId, { isAdmin, substituteFor });



  const isSignTask = myTask?.action_required === "sign";



  const mutation = useWorkflowTaskActions({ documentId });

  const submitDecision = (decision: DecisionType) => {
    if (!myTask) {
      toast.error(t("doc.action.noTask"));
      return;
    }
    const cleanComment = comment.trim();
    if ((decision === "reject" || decision === "return") && !cleanComment) {
      toast.error(t("doc.action.commentRequired"));
      return;
    }
    mutation.mutate(
      { task_id: myTask.id, decision, comment: cleanComment || null },
      { onSuccess: () => setComment("") },
    );
  };



  const delegateMutation = useMutation({
    mutationFn: () => {
      if (!myTask) return Promise.reject(new Error(t("doc.action.noTask")));
      if (!delegateUserId) return Promise.reject(new Error(t("delegate.selectUser")));
      return delegateWorkflowTask({
        data: {
          task_id: myTask.id,
          to_user_id: delegateUserId,
          comment: delegateComment.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("delegate.success"));
      setDelegateOpen(false);
      setDelegateUserId("");
      setDelegateComment("");
      qc.invalidateQueries({ queryKey: ["document", documentId] });
      qc.invalidateQueries({ queryKey: ["myTasks"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("delegate.error")),
  });

  const signMutation = useMutation({

    mutationFn: async () => {

      if (!myTask) throw new Error(t("doc.action.noTask"));



      const signText = signPayload || documentId;
      const payload = toSignPayload(signText);
      const result = await signCMSFull(payload);

      await addSignature({
        data: buildSignatureInsertData({
          documentId,
          signText,
          result,
          workflowTaskId: myTask.id,
        }),
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

          {substitutePrincipalName ? (
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-400 text-amber-800 dark:text-amber-300">
              <UserRoundCog className="w-3 h-3" />
              {interpolate(t("substitution.forUser"), { name: substitutePrincipalName })}
            </Badge>
          ) : null}

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

        {substitutePrincipalName ? (
          <Badge variant="outline" className="text-[10px] gap-1 border-amber-400 text-amber-800 dark:text-amber-300">
            <UserRoundCog className="w-3 h-3" />
            {interpolate(t("substitution.forUser"), { name: substitutePrincipalName })}
          </Badge>
        ) : null}

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

            onClick={() => submitDecision("approve")}

          >

            {mutation.isPending && mutation.variables?.decision === "approve" ? (

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

            onClick={() => submitDecision("return")}

            title={isCommentEmpty ? t("doc.action.commentRequired") : ""}

          >

            {mutation.isPending && mutation.variables?.decision === "return" ? (

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

            onClick={() => submitDecision("reject")}

            title={isCommentEmpty ? t("doc.action.commentRequired") : ""}

          >

            {mutation.isPending && mutation.variables?.decision === "reject" ? (

              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />

            ) : (

              <X className="w-4 h-4 mr-1" />

            )}

            {t("doc.action.reject")}

          </Button>

        </div>

        <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="w-full" disabled={actionBlocked}>
              <UserPlus className="w-4 h-4 mr-1" />
              {t("delegate.title")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("delegate.title")}</DialogTitle>
            </DialogHeader>
            <Select
              value={delegateUserId || "none"}
              onValueChange={(v) => setDelegateUserId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("delegate.selectUser")} />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {localized(u, locale, "full_name") || u.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Textarea
              rows={2}
              placeholder={t("doc.links.note")}
              value={delegateComment}
              onChange={(e) => setDelegateComment(e.target.value)}
            />
            <DialogFooter>
              <Button
                onClick={() => delegateMutation.mutate()}
                disabled={!delegateUserId || delegateMutation.isPending}
              >
                {t("common.submit")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CardContent>

    </Card>

  );

}
