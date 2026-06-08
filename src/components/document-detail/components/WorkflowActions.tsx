import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Undo2 } from "lucide-react";
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

export function WorkflowActions({ documentId, tasks, currentUserId }: Props) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const myTask = tasks.find(
    (t) => t.status === "pending" && t.assignee_id === currentUserId,
  );

  const mutation = useMutation({
    mutationFn: (decision: "approve" | "reject" | "return") =>
      advanceWorkflowTask({
        data: { task_id: myTask!.id, decision, comment: comment.trim() || null },
      }),
    onSuccess: (res, decision) => {
      toast.success(
        decision === "approve"
          ? "Согласовано"
          : decision === "reject"
            ? "Отклонено"
            : "Возвращено на доработку",
      );
      setComment("");
      qc.invalidateQueries({ queryKey: ["document", documentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!myTask) return null;

  return (
    <Card className="rounded-sm border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Моё действие</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Задача: <span className="text-foreground font-medium">{myTask.title}</span>
        </div>
        <Textarea
          placeholder="Комментарий (обязателен для отклонения и возврата)"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("approve")}
          >
            <Check className="w-4 h-4 mr-1" />
            Согласовать
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={mutation.isPending || !comment.trim()}
            onClick={() => mutation.mutate("return")}
          >
            <Undo2 className="w-4 h-4 mr-1" />
            На доработку
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={mutation.isPending || !comment.trim()}
            onClick={() => mutation.mutate("reject")}
          >
            <X className="w-4 h-4 mr-1" />
            Отклонить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
