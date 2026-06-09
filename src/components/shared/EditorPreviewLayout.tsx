import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EditorPreviewLayoutProps {
  children: ReactNode;
  preview: ReactNode;
  showPreview?: boolean;
  className?: string;
}

export function EditorPreviewLayout({
  children,
  preview,
  showPreview = true,
  className,
}: EditorPreviewLayoutProps) {
  if (!showPreview) {
    return <div className={cn("max-w-3xl space-y-4", className)}>{children}</div>;
  }

  return (
    <div
      className={cn(
        "flex min-h-[calc(100dvh-10rem)] flex-col gap-4 lg:flex-row lg:items-stretch",
        className,
      )}
    >
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto lg:max-w-[46%]">
        {children}
      </div>
      <aside className="flex h-full min-h-[min(420px,calc(100dvh-10rem))] min-w-0 flex-1 flex-col lg:max-h-[calc(100dvh-10rem)]">
        {preview}
      </aside>
    </div>
  );
}
