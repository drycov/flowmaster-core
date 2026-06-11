import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NODE_PALETTE_GROUPS, NODE_TYPE_LABEL_KEYS } from "../constants";
import { WorkflowNodeIcon } from "./WorkflowNodeIcon";
import { useI18n } from "@/i18n";
import type { NodeType } from "../types";

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const { t } = useI18n();

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex w-[72px] shrink-0 flex-col border-r bg-muted/30">
        <div className="border-b px-2 py-2 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("wf.palette.title")}
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-2">
            {NODE_PALETTE_GROUPS.map((group, groupIdx) => (
              <div key={group.key} className="space-y-1">
                {groupIdx > 0 && <div className="mx-1 border-t" />}
                {group.types.map((type) => (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        draggable
                        className="h-10 w-full cursor-grab active:cursor-grabbing hover:bg-background"
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/workflow-node-type", type);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => onAddNode(type)}
                      >
                        <WorkflowNodeIcon type={type} className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {t(NODE_TYPE_LABEL_KEYS[type])}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  );
}
