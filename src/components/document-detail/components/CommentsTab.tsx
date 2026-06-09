import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useI18n } from "@/i18n";
import { fmtDate } from "@/lib/format";
import type { DocumentComment } from "../types";

interface CommentsTabProps {
  comments: DocumentComment[];
  onAddComment: (body: string) => void;
  isAdding: boolean;
}

export function CommentsTab({ comments, onAddComment, isAdding }: CommentsTabProps) {
  const [comment, setComment] = useState("");
  const { locale, t } = useI18n();

  const handleSubmit = () => {
    if (comment.trim()) {
      onAddComment(comment);
      setComment("");
    }
  };

  return (
    <Card className="rounded-sm">
      <CardContent className="p-4 space-y-3">
        {comments.length === 0 && (
          <div className="text-sm text-muted-foreground">{t("common.empty")}</div>
        )}
        
        {comments.map((c) => (
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
          <Button size="sm" onClick={handleSubmit} disabled={!comment.trim() || isAdding}>
            <Send className="w-4 h-4 mr-1" />
            {t("common.submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}