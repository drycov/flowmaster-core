import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { diffLines, stripHtml } from "@/lib/documents/text-diff";
import type { DocumentVersion } from "../types";
import { GitCompare } from "lucide-react";

interface VersionDiffPanelProps {
  versions: DocumentVersion[];
}

export function VersionDiffPanel({ versions }: VersionDiffPanelProps) {
  const { t } = useI18n();
  const sorted = useMemo(
    () => [...versions].sort((a, b) => a.version_no - b.version_no),
    [versions],
  );

  const [leftNo, setLeftNo] = useState<string>("");
  const [rightNo, setRightNo] = useState<string>("");
  const [showDiff, setShowDiff] = useState(false);

  const left = sorted.find((v) => String(v.version_no) === leftNo);
  const right = sorted.find((v) => String(v.version_no) === rightNo);

  const diff = useMemo(() => {
    if (!left || !right) return [];
    const a = stripHtml(left.body_snapshot ?? "");
    const b = stripHtml(right.body_snapshot ?? "");
    return diffLines(a, b);
  }, [left, right]);

  const hashChanged =
    left?.content_hash && right?.content_hash && left.content_hash !== right.content_hash;

  if (sorted.length < 2) return null;

  return (
    <div className="border-t border-border p-4 space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <GitCompare className="w-4 h-4" />
        {t("doc.versions.diff")}
      </h4>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36">
          <Select value={leftNo || "none"} onValueChange={(v) => setLeftNo(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("doc.versions.diffFrom")} />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((v) => (
                <SelectItem key={v.id} value={String(v.version_no)}>
                  v{v.version_no}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select
            value={rightNo || "none"}
            onValueChange={(v) => setRightNo(v === "none" ? "" : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("doc.versions.diffTo")} />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((v) => (
                <SelectItem key={v.id} value={String(v.version_no)}>
                  v{v.version_no}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!leftNo || !rightNo || leftNo === rightNo}
          onClick={() => setShowDiff(true)}
        >
          {t("doc.versions.compare")}
        </Button>
      </div>

      {showDiff && left && right && (
        <div className="space-y-2">
          {hashChanged && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("doc.versions.fileChanged")}
            </p>
          )}
          {!left.body_snapshot && !right.body_snapshot ? (
            <p className="text-sm text-muted-foreground">{t("doc.versions.noTextSnapshot")}</p>
          ) : (
            <pre className="text-xs font-mono bg-muted/40 border border-border rounded-sm p-3 max-h-80 overflow-auto whitespace-pre-wrap">
              {diff.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.type === "add"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : line.type === "remove"
                        ? "text-red-700 dark:text-red-400 line-through"
                        : "text-foreground"
                  }
                >
                  {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                  {line.text || " "}
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
