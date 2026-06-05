import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch } from "lucide-react";
import { useI18n, localized } from "@/lib/i18n";

interface StartWorkflowDialogProps {
  workflows: Array<{ id: string; name_ru: string; name_kk: string }>;
  onStart: (workflowId: string) => void;
  isStarting: boolean;
}

export function StartWorkflowDialog({ workflows, onStart, isStarting }: StartWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState("");
  const { locale } = useI18n();

  const handleStart = () => {
    if (selectedWorkflow) {
      onStart(selectedWorkflow);
      setOpen(false);
      setSelectedWorkflow("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <GitBranch className="w-4 h-4 mr-1" />
          Запустить маршрут
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Запустить маршрут согласования</DialogTitle>
        </DialogHeader>
        <Select value={selectedWorkflow} onValueChange={setSelectedWorkflow}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите маршрут..." />
          </SelectTrigger>
          <SelectContent>
            {workflows.map((wf) => (
              <SelectItem key={wf.id} value={wf.id}>
                {localized(wf, locale, "name")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={handleStart} disabled={!selectedWorkflow || isStarting}>
            {isStarting ? "Запуск..." : "Запустить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}