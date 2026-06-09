import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield } from "lucide-react";
import { useI18n, localized } from "@/i18n";
import { listAccessLevelsBrief } from "@/lib/api/references.functions";
import { setUserAccessLevel } from "@/lib/api/admin.functions";
import { toast } from "sonner";

interface UserAccessLevelCardProps {
  userId: string;
  accessLevelId?: string | null;
}

export function UserAccessLevelCard({ userId, accessLevelId }: UserAccessLevelCardProps) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  const { data: levels = [] } = useQuery({
    queryKey: ["ref-access-levels-brief"],
    queryFn: listAccessLevelsBrief,
  });

  const mutation = useMutation({
    mutationFn: (levelId: string | null) =>
      setUserAccessLevel({
        data: { user_id: userId, access_level_id: levelId },
      }),
    onSuccess: () => {
      toast.success(t("access.levelSaved"));
      qc.invalidateQueries({ queryKey: ["user-profile", userId] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("access.levelError")),
  });

  return (
    <Card className="rounded-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" />
          {t("access.userClearance")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">{t("access.userClearanceHint")}</p>
        <Select
          value={accessLevelId ?? ""}
          onValueChange={(v) => mutation.mutate(v || null)}
          disabled={mutation.isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("access.selectLevel")} />
          </SelectTrigger>
          <SelectContent>
            {levels.map((level) => (
              <SelectItem key={level.id} value={level.id}>
                {localized(level, locale, "name")} ({level.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
