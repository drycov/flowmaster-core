import { Card, CardContent } from "@/components/ui/card";

interface ContentTabProps {
  body?: string;
  summary?: string;
}

export function ContentTab({ body, summary }: ContentTabProps) {
  return (
    <Card className="rounded-sm">
      <CardContent className="p-6 prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm">
        {summary && <p className="text-muted-foreground italic">{summary}</p>}
        {body || <span className="text-muted-foreground">Нет содержимого</span>}
      </CardContent>
    </Card>
  );
}