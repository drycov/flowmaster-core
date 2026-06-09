import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n, localized } from "@/lib/i18n";
import { GitFork, Play, CheckCircle2, AlertCircle, Clock } from "lucide-react"; 
import type { WorkflowRun } from "../types";

interface WorkflowCardProps {
  runs: WorkflowRun[];
}

function getNodeLabel(run: WorkflowRun, locale: string): string {
  if (!run.current_node) return "—";

  const definition = run.workflows?.definition;
  if (definition) {
    try {
      // Парсим схему, если она пришла в виде JSON-строки
      const parsedDef = typeof definition === "string" ? JSON.parse(definition) : definition;
      
      // Ищем узел в графе по текущему ID
      const currentNodeData = parsedDef.nodes?.find((n: any) => n.id === run.current_node);

      if (currentNodeData) {
        // Лог для отладки в консоли браузера, чтобы точно увидеть структуру узла:
        console.log("Данные текущего узла маршрута:", currentNodeData);

        // 1. Проверяем стандартный объект data (React Flow)
        if (currentNodeData.data) {
          const labelRu = currentNodeData.data.name_ru || 
                          currentNodeData.data.label_ru || 
                          currentNodeData.data.label || 
                          currentNodeData.data.name;
          const labelKk = currentNodeData.data.name_kk || 
                          currentNodeData.data.label_kk;

          if (locale === "kk" && labelKk) return labelKk;
          if (labelRu) return labelRu;
        }

        // 2. Фолбэк: если метаданные лежат на верхнем уровне самого узла
        const topLabelRu = currentNodeData.name_ru || currentNodeData.label_ru || currentNodeData.label || currentNodeData.name;
        const topLabelKk = currentNodeData.name_kk || currentNodeData.label_kk;

        if (locale === "kk" && topLabelKk) return topLabelKk;
        if (topLabelRu) return topLabelRu;
      }
    } catch (e) {
      console.error("Ошибка при парсинге или поиске узла внутри definition:", e);
    }
  }

  // Фолбэк для системных узлов
  if (run.current_node.toLowerCase() === "start") return "Начало процесса";
  if (run.current_node.toLowerCase() === "end") return "Завершено";

  // Если текст совсем не найден в схеме, делаем ID более читаемым для пользователя
  if (run.current_node.startsWith("node_")) {
    const timestamp = run.current_node.split("_")[1];
    // Если это таймстамп, можно вывести его как порядковый номер, но лучше вернуть "Действие без названия"
    return `Безымянный этап (ID: ${timestamp?.slice(-5) || "—"})`;
  }

  return run.current_node;
}

function getStatusConfig(status: string) {
  switch (status.toLowerCase()) {
    case "active":
    case "running":
    case "pending":
      return {
        bg: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
        icon: <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 mr-1 animate-pulse" />,
        label: "Выполняется",
      };
    case "completed":
    case "success":
    case "approved":
      return {
        bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1" />,
        label: "Завершен",
      };
    case "rejected":
    case "cancelled":
    case "failed":
      return {
        bg: "bg-destructive/10 text-destructive dark:bg-destructive/20",
        icon: <AlertCircle className="w-3 h-3 text-destructive mr-1" />,
        label: "Отклонен",
      };
    default:
      return {
        bg: "bg-muted text-muted-foreground",
        icon: <Play className="w-3 h-3 mr-1" />,
        label: status,
      };
  }
}

export function WorkflowCard({ runs }: WorkflowCardProps) {
  const { locale, t } = useI18n();

  return (
    <Card className="rounded-sm shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <GitFork className="w-4 h-4 text-primary" />
          {t("doc.workflow")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-2 italic text-center">
            {t("common.empty") || "Маршруты не запущены"}
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((r, index) => {
              const statusCfg = getStatusConfig(r.status);
              const workflowName = r.workflows ? localized(r.workflows, locale, "name") : "Без названия";
              
              // ИСПРАВЛЕНО: Вычисление вынесено внутрь контекста итератора конкретного рана
              const nodeName = getNodeLabel(r, locale);

              return (
                <div
                  // Использован составной уникальный ключ для безопасного рендеринга списков
                  key={`${r.id}-${index}`}
                  className="border border-border rounded-sm p-3 bg-muted/30 hover:bg-muted/50 transition-colors space-y-2.5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-sm text-foreground break-words max-w-[70%]">
                      {workflowName}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-medium ${statusCfg.bg}`}>
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex justify-between items-center pt-2 border-t border-border/40">
                    <span>Текущий этап:</span>
                    <span
                      className={`font-medium px-2 py-0.5 rounded text-foreground bg-background border border-border/60 max-w-[60%] truncate ${
                        r.current_node?.startsWith("node_") ? "font-sans" : "font-mono text-xs"
                      }`}
                      title={r.current_node ?? "—"}
                    >
                      {nodeName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}