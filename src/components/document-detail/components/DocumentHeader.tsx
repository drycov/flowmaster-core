import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import { GitBranch, Shield, Archive, ArrowLeft } from "lucide-react";
import type { Document } from "../types";
import { StartWorkflowDialog } from "./StartWorkflowDialog";

interface DocumentHeaderProps {
  document: Document;
  onBack: () => void;
  onSign: () => void;
  onArchive: () => void;
  isSigning: boolean;
  isArchiving: boolean;
  workflows: Array<{ id: string; name_ru: string; name_kk: string }>;
  onStartWorkflow: (workflowId: string) => void;
  isStartingWorkflow: boolean;
}

export function DocumentHeader({
  document,
  onBack,
  onSign,
  onArchive,
  isSigning,
  isArchiving,
  workflows,
  onStartWorkflow,
  isStartingWorkflow,
}: DocumentHeaderProps) {
  const title = document.title_ru || document.title_kk;

  return (
    <PageHeader
      title={title}
      description={`Рег. номер: ${document.reg_number}`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Назад
          </Button>

          <StartWorkflowDialog
            workflows={workflows}
            onStart={onStartWorkflow}
            isStarting={isStartingWorkflow}
          />

          <Button size="sm" onClick={onSign} disabled={isSigning}>
            <Shield className="w-4 h-4 mr-1" />
            Подписать
          </Button>

          <Button size="sm" variant="outline" onClick={onArchive} disabled={isArchiving}>
            <Archive className="w-4 h-4 mr-1" />
            В архив
          </Button>
        </>
      }
    />
  );
}