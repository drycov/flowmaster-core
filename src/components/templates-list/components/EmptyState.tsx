import { ReactNode } from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  children?: ReactNode;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  children 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="bg-muted/50 rounded-full p-4 mb-4">
          {icon}
        </div>
      )}
      
      {title && (
        <h3 className="text-lg font-semibold mb-2">
          {title}
        </h3>
      )}
      
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {description}
        </p>
      )}
      
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {action.label}
        </Button>
      )}
      
      {children}
    </div>
  );
}

// Пример использования с кастомным содержимым:
// <EmptyState
//   icon={<FileText className="w-12 h-12 text-muted-foreground" />}
//   title="Нет шаблонов"
//   description="Создайте первый шаблон документа"
//   action={{
//     label: "Создать шаблон",
//     onClick: () => createTemplate(),
//     icon: <Plus className="w-4 h-4" />
//   }}
// />