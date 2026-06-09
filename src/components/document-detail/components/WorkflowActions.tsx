import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Undo2, Loader2, MessageSquare } from "lucide-react"; // Добавили Loader2 для состояния загрузки
import { toast } from "sonner";
import { advanceWorkflowTask } from "@/lib/api/workflows.functions";

interface Task {
  id: string;
  title: string;
  node_id: string;
  node_type: string;
  status: string;
  assignee_id: string | null;
  action_required: string;
  due_at: string | null;
}

interface Props {
  documentId: string;
  tasks: Task[];
  currentUserId?: string;
}

type DecisionType = "approve" | "reject" | "return";

export function WorkflowActions({ documentId, tasks, currentUserId }: Props) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  // Безопасный поиск активной задачи текущего пользователя
  const myTask = tasks?.find(
    (t) => t.status === "pending" && t.assignee_id === currentUserId,
  );

  const mutation = useMutation({
    mutationFn: (decision: DecisionType) => {
      // Дополнительная runtime-проверка безопасности, чтобы TS не ругался на myTask!.id
      if (!myTask) {
        return Promise.reject(new Error("Активная задача не найдена"));
      }

      // Валидация комментария перед отправкой на бэкенд
      const cleanComment = comment.trim();
      if ((decision === "reject" || decision === "return") && !cleanComment) {
        return Promise.reject(new Error("Для данного действия необходимо указать комментарий"));
      }

      return advanceWorkflowTask({
        data: { 
          task_id: myTask.id, 
          decision, 
          comment: cleanComment || null 
        },
      });
    },
    onSuccess: (_, decision) => {
      const messages: Record<DecisionType, string> = {
        approve: "Документ успешно согласован",
        return: "Документ возвращен на доработку",
        reject: "Документ отклонен",
      };

      toast.success(messages[decision]);
      setComment("");
      
      // Инвалидируем кэш документа и связанных списков воркфлоу
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Произошла ошибка при выполнении действия");
    },
  });

  if (!myTask) return null;

  const isPending = mutation.isPending;
  const isCommentEmpty = !comment.trim();

  return (
    <Card className="rounded-sm border-primary/40 shadow-sm bg-gradient-to-b from-background to-muted/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
          <MessageSquare className="w-4 h-4 text-primary" />
          Моё действие
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground bg-background p-2 rounded border border-border/60">
          Текущая задача: <span className="text-foreground font-semibold">{myTask.title}</span>
        </div>
        
        <Textarea
          placeholder="Укажите комментарий (обязательно при отклонении или возврате на доработку)..."
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isPending}
          className="resize-none focus-visible:ring-primary/50 text-sm"
        />
        
        <div className="grid grid-cols-3 gap-2">
          {/* Кнопка: Согласовать */}
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={isPending}
            onClick={() => mutation.mutate("approve")}
          >
            {isPending && mutation.variables === "approve" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Согласовать
          </Button>

          {/* Кнопка: На доработку */}
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 font-medium"
            disabled={isPending || isCommentEmpty}
            onClick={() => mutation.mutate("return")}
            title={isCommentEmpty ? "Заполните комментарий для возврата" : ""}
          >
            {isPending && mutation.variables === "return" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Undo2 className="w-4 h-4 mr-1" />
            )}
            На доработку
          </Button>

          {/* Кнопка: Отклонить */}
          <Button
            size="sm"
            variant="destructive"
            className="font-medium"
            disabled={isPending || isCommentEmpty}
            onClick={() => mutation.mutate("reject")}
            title={isCommentEmpty ? "Заполните комментарий для отклонения" : ""}
          >
            {isPending && mutation.variables === "reject" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <X className="w-4 h-4 mr-1" />
            )}
            Отклонить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}