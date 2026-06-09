import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DOMPurify from "dompurify";

interface ContentTabProps {
  /** Исходная HTML-строка с токенами типа {{registration_number}} */
  bodyTemplate?: string;
  /** Объект с реальными значениями для замены токенов */
  fieldValues?: Record<string, string>;
  summary?: string;
  isEditable?: boolean;
  onSave?: (content: string) => Promise<void>;
}

/**
 * Функция утилиты для замены динамических токенов вида {{key}} на реальные значения
 */
function compileTemplate(template: string, values: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([\w\-_\.]+)\s*\}\}/g, (match, key) => {
    return values[key] !== undefined ? values[key] : "";
  });
}

export function ContentTab({
  bodyTemplate = "",
  fieldValues = {},
  summary,
  isEditable = false,
  onSave,
}: ContentTabProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(bodyTemplate);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Компилируем шаблон, подставляя значения полей
  const compiledHtml = compileTemplate(bodyTemplate, fieldValues);

  // 2. Санитизируем скомпилированный HTML, защищая приложение от XSS-атак
  const sanitizedHtml = DOMPurify.sanitize(compiledHtml);

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(editedBody);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedBody(bodyTemplate);
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    setEditedBody(bodyTemplate); // Передаем на редактирование именно сырой шаблон с {{тегами}}
    setIsEditing(true);
  };

  return (
    <Card className="rounded-sm">
      <CardContent className="p-6">
        {isEditable && !isEditing && (
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="outline" onClick={handleStartEditing}>
              <Pencil className="w-4 h-4 mr-1" />
              Редактировать
            </Button>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={15}
              className="font-mono text-sm"
              placeholder="Введите содержимое документа или структуру шаблона..."
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" />
                Отмена
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {summary && (
              <p className="text-muted-foreground italic mb-4">{summary}</p>
            )}

            {/* Зона отображения готового документа */}
            {compiledHtml ? (
              <div
                className="prose prose-sm max-w-none document-view-output"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <span>{t("common.empty")}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}