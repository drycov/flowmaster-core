import { useQuery } from "@tanstack/react-query";
import { getDocument } from "@/lib/api/documents.functions";
import type { DocumentData, Task } from "../types"; // Если интерфейс Task лежит в types.ts, импортируем его

// Локальный интерфейс для случая, если Task еще не импортирован из типов
interface LocalTask {
  id: string;
  run_id: string;
  title: string;
  node_id: string;
  node_type: string;
  status: string;
  assignee_id: string | null;
  action_required: string;
  due_at: string | null;
  completed_at?: string | null;
  decision?: string | null;
}

// Интерфейс для типизации схемы, которая может лежать внутри строки document.body
interface ParsedSchema {
  body_template: string;
  fields?: any[];
}

export function useDocumentData(id: string) {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument({ data: { id } }),
    
    // Трансформируем полученный ответ под нужды интерфейса просмотра
    select: (rawResponse) => {
      // Приводим к any, чтобы безопасно извлечь скрытое в DocumentData поле tasks
      const fullData = rawResponse as any;
      if (!fullData || !fullData.document) return undefined;

      const { document, tasks } = fullData;

      let finalTemplate = "";
      
      // Проверяем, что лежит в document.body
      if (document.body) {
        // Если в body записана JSON-строка (из конструктора шаблонов)
        if (document.body.trim().startsWith("{")) {
          try {
            const parsed: ParsedSchema = JSON.parse(document.body);
            finalTemplate = parsed.body_template || "";
          } catch (e) {
            console.error("Ошибка парсинга JSON из document.body:", e);
            finalTemplate = document.body; // Фолбэк на сырой текст, если парсинг упал
          }
        } else {
          // Если там уже лежит чистый HTML/текст с токенами
          finalTemplate = document.body;
        }
      }

      // Сопоставляем ключи токенов из шаблона ({{ключ}}) с реальными полями вашей модели Document
      const fieldValues: Record<string, string> = {
        registration_number: document.reg_number || "",
        reg_number: document.reg_number || "",
        document_title: document.title_ru || document.title_kk || "",
        title_ru: document.title_ru || "",
        title_kk: document.title_kk || "",
        document_date: document.created_at?.slice(0, 10) || "",
        status: document.status || "",
        doc_type: document.doc_type || "",
      };

      // Явно возвращаем строго типизированный объект
      return {
        ...(fullData as DocumentData),
        tasks: (tasks || []) as LocalTask[], // Гарантируем наличие массива задач для компонента
        compiledBodyTemplate: finalTemplate, // Готовый шаблон текста
        documentFields: fieldValues,         // Плоский объект значений для компиляции
      };
    },
  });

  return {
    data, // Теперь data автоматически имеет тип, содержащий поле tasks!
    refetch,
    isLoading,
  };
}