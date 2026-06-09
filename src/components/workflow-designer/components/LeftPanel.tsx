import { Label } from "@/components/ui/label";

import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";

import { Button } from "@/components/ui/button";

import { NODE_PALETTE_GROUPS, NODE_TYPE_LABEL_KEYS, NODE_TYPE_ICONS } from "../constants";

import { useI18n } from "@/i18n";

import type { WorkflowStatus } from "../types";



interface LeftPanelProps {

  nameRu: string;

  nameKk: string;

  description: string;

  status: WorkflowStatus;

  validationErrors: string[];

  nodesCount: number;

  edgesCount: number;

  onNameRuChange: (value: string) => void;

  onNameKkChange: (value: string) => void;

  onDescriptionChange: (value: string) => void;

  onStatusChange: (value: WorkflowStatus) => void;

  onAddNode: (type: string) => void;

}



export function LeftPanel({

  nameRu,

  nameKk,

  description,

  validationErrors,

  nodesCount,

  edgesCount,

  onNameRuChange,

  onNameKkChange,

  onDescriptionChange,

  onAddNode,

}: LeftPanelProps) {

  const { t } = useI18n();



  return (

    <div className="space-y-4 overflow-y-auto pr-2">

      <div className="space-y-2">

        <Label className="text-sm font-semibold">{t("wf.nameRu")}</Label>

        <Input value={nameRu} onChange={(e) => onNameRuChange(e.target.value)} placeholder={t("wf.nameRu")} />

      </div>



      <div className="space-y-2">

        <Label className="text-sm font-semibold">{t("wf.nameKk")}</Label>

        <Input value={nameKk} onChange={(e) => onNameKkChange(e.target.value)} placeholder={t("wf.nameKk")} />

      </div>



      <div className="space-y-2">

        <Label className="text-sm font-semibold">{t("common.description")}</Label>

        <Textarea

          value={description}

          onChange={(e) => onDescriptionChange(e.target.value)}

          placeholder={t("wf.description")}

          rows={3}

        />

      </div>



      {validationErrors.length > 0 && (

        <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-1">

          <Label className="text-red-800 text-sm font-semibold">{t("wf.validationErrors")}</Label>

          {validationErrors.map((error, idx) => (

            <div key={idx} className="text-red-700 text-xs flex items-start gap-2">

              <span className="mt-0.5">•</span>

              <span>{error}</span>

            </div>

          ))}

        </div>

      )}



      <div className="border-t pt-4 space-y-3">
        <Label className="text-sm font-semibold block">{t("wf.add_node")}</Label>
        {NODE_PALETTE_GROUPS.map((group) => (
          <div key={group.key} className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(group.labelKey)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {group.types.map((tp) => (
                <Button
                  key={tp}
                  size="sm"
                  variant="outline"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/workflow-node-type", tp);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAddNode(tp)}
                  className="justify-start px-2 cursor-grab active:cursor-grabbing"
                >
                  <span className="mr-1">{NODE_TYPE_ICONS[tp]}</span>
                  <span className="text-xs">{t(NODE_TYPE_LABEL_KEYS[tp])}</span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>



      <div className="border-t pt-4">

        <div className="text-xs text-muted-foreground space-y-1">

          <div>{t("wf.nodesCount")} {nodesCount}</div>

          <div>{t("wf.edgesCount")} {edgesCount}</div>

        </div>

      </div>

    </div>

  );

}

