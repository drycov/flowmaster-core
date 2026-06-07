import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import {
  createAssignment,
  terminateAssignment,
  listUserAssignments,
} from "@/lib/api/assignments.functions";
import { listDepartments } from "@/lib/api/admin.functions";
import { listPositions } from "@/lib/api/org.functions";
import { useRole } from "@/hooks/use-role";

interface AssignmentsCardProps {
  userId: string;
}

export function AssignmentsCard({ userId }: AssignmentsCardProps) {
  const qc = useQueryClient();
  const { can } = useRole();
  const canManage = can("manage_users");
  const [open, setOpen] = useState(false);
  const [deptId, setDeptId] = useState<string>("none");
  const [posId, setPosId] = useState<string>("none");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isPrimary, setIsPrimary] = useState(true);
  const [note, setNote] = useState("");

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["assignments", userId],
    queryFn: () => listUserAssignments({ data: { user_id: userId } }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["depts"],
    queryFn: () => listDepartments(),
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
  });

  const create = useMutation({
    mutationFn: () =>
      createAssignment({
        data: {
          user_id: userId,
          department_id: deptId === "none" ? null : deptId,
          position_id: posId === "none" ? null : posId,
          start_date: startDate,
          is_primary: isPrimary,
          notes: note || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Назначение создано");
      qc.invalidateQueries({ queryKey: ["assignments", userId] });
      setOpen(false);
      setDeptId("none");
      setPosId("none");
      setNote("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const close = useMutation({
    mutationFn: () => terminateAssignment({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Назначение завершено");
      qc.invalidateQueries({ queryKey: ["assignments", userId] });
    },
  });

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">История назначений</CardTitle>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Новое назначение
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новое назначение</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Подразделение</Label>
                  <Select value={deptId} onValueChange={setDeptId}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {(departments as any[]).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name_ru} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Должность</Label>
                  <Select value={posId} onValueChange={setPosId}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {(positions as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title_ru}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Дата начала</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isPrimary} onCheckedChange={setIsPrimary} id="prim" />
                  <Label htmlFor="prim">Основное назначение</Label>
                </div>
                <div>
                  <Label>Примечание</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Сохранить
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Назначений нет</p>
        ) : (
          <div className="space-y-2">
            {(assignments as any[]).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm border rounded-sm px-3 py-2"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {a.positions?.title_ru ?? "—"}{" "}
                    {a.departments && (
                      <span className="text-muted-foreground">
                        · {a.departments.name_ru}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.start_date}
                    {a.end_date ? ` — ${a.end_date}` : " — настоящее время"}
                    {a.is_primary && (
                      <Badge variant="secondary" className="ml-2">
                        основное
                      </Badge>
                    )}
                  </div>
                  {a.note && <div className="text-xs italic">{a.note}</div>}
                </div>
                {canManage && !a.end_date && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => close.mutate(a.id)}
                    title="Завершить"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
