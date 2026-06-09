// src/components/templates-list/components/TemplateGrid.tsx
import type { ReferenceCodeOption } from "@/components/references/ReferenceCodeSelect";
import { EmptyState } from "./EmptyState";
import { TemplateCard } from "./TemplateCard";

// Используем более гибкий тип
interface TemplateGridProps {
  templates: Array<{
    id: string;
    name_ru: string;
    name_kk: string;
    category: string;
    status: string;
    version: number;
    updated_at: string;
  }>;
  categories?: ReferenceCodeOption[];
  isLoading?: boolean;
}

export function TemplateGrid({ templates, categories = [], isLoading }: TemplateGridProps) {
  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border border-border bg-card rounded-sm p-4 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-5 bg-muted rounded w-16" />
            </div>
            <div className="h-3 bg-muted rounded w-24 mt-2" />
            <div className="flex justify-between mt-3">
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid lg:grid-cols-3 gap-3">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} categories={categories} />
      ))}
    </div>
  );
}
