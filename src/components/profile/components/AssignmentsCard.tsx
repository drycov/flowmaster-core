import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import {

  Dialog,

  DialogContent,

  DialogDescription,

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

import { listDepartments, listUsersBrief } from "@/lib/api/admin.functions";

import { listPositions } from "@/lib/api/org.functions";

import { useRole } from "@/hooks/use-role";

import { useI18n, localized } from "@/i18n";



const REASON_KEYS = [

  "hire",

  "transfer",

  "promotion",

  "temporary",

  "termination",

  "reinstatement",

  "correction",

] as const;



interface AssignmentsCardProps {

  userId: string;

}



export function AssignmentsCard({ userId }: AssignmentsCardProps) {

  const { t, locale } = useI18n();

  const qc = useQueryClient();

  const { can } = useRole();

  const canManage = can("manage_users");

  const [open, setOpen] = useState(false);

  const [deptId, setDeptId] = useState<string>("none");

  const [posId, setPosId] = useState<string>("none");

  const [managerId, setManagerId] = useState<string>("none");

  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [endDate, setEndDate] = useState<string>("");

  const [isPrimary, setIsPrimary] = useState(true);

  const [isTemporary, setIsTemporary] = useState(false);

  const [reason, setReason] = useState<string>("transfer");

  const [note, setNote] = useState("");



  const reasonLabel = (key: string) =>

    t(`profile.assignments.reason.${key}` as "profile.assignments.reason.hire") !==

    `profile.assignments.reason.${key}`

      ? t(`profile.assignments.reason.${key}` as "profile.assignments.reason.hire")

      : key;



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

  const { data: users = [] } = useQuery({

    queryKey: ["users-brief"],

    queryFn: () => listUsersBrief(),

    enabled: canManage,

  });



  const create = useMutation({

    mutationFn: () =>

      createAssignment({

        data: {

          user_id: userId,

          department_id: deptId === "none" ? null : deptId,

          position_id: posId === "none" ? null : posId,

          manager_user_id: managerId === "none" ? null : managerId,

          start_date: startDate,

          is_primary: isPrimary,

          is_temporary: isTemporary,

          reason: reason as

            | "hire"

            | "transfer"

            | "promotion"

            | "temporary"

            | "termination"

            | "reinstatement"

            | "correction",

          notes: note || undefined,

        },

      }),

    onSuccess: () => {

      toast.success(t("profile.assignments.created"));

      qc.invalidateQueries({ queryKey: ["assignments", userId] });

      qc.invalidateQueries({ queryKey: ["my-profile"] });

      setOpen(false);

      resetForm();

    },

    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),

  });



  const close = useMutation({

    mutationFn: (endDateValue?: string) =>

      terminateAssignment({

        data: {

          user_id: userId,

          end_date: endDateValue,

          reason: "termination",

        },

      }),

    onSuccess: () => {

      toast.success(t("profile.assignments.terminated"));

      qc.invalidateQueries({ queryKey: ["assignments", userId] });

      qc.invalidateQueries({ queryKey: ["my-profile"] });

    },

  });



  const resetForm = () => {

    setDeptId("none");

    setPosId("none");

    setManagerId("none");

    setNote("");

    setEndDate("");

    setIsTemporary(false);

    setReason("transfer");

  };



  return (

    <Card className="rounded-sm">

      <CardHeader className="flex flex-row items-center justify-between">

        <CardTitle className="text-sm">{t("profile.assignments.title")}</CardTitle>

        {canManage && (

          <Dialog open={open} onOpenChange={setOpen}>

            <DialogTrigger asChild>

              <Button size="sm" variant="outline">

                <Plus className="h-4 w-4 mr-1" /> {t("profile.assignments.new")}

              </Button>

            </DialogTrigger>

            <DialogContent className="max-w-md">

              <DialogHeader>

                <DialogTitle>{t("profile.assignments.new")}</DialogTitle>

                <DialogDescription>{t("profile.assignments.newDescription")}</DialogDescription>

              </DialogHeader>

              <div className="space-y-3">

                <div>

                  <Label>{t("profile.assignments.department")}</Label>

                  <Select value={deptId} onValueChange={setDeptId}>

                    <SelectTrigger>

                      <SelectValue placeholder="—" />

                    </SelectTrigger>

                    <SelectContent>

                      <SelectItem value="none">—</SelectItem>

                      {(departments as { id: string; name_ru: string; name_kk: string; code: string }[]).map(

                        (d) => (

                          <SelectItem key={d.id} value={d.id}>

                            {localized(d, locale, "name")} ({d.code})

                          </SelectItem>

                        ),

                      )}

                    </SelectContent>

                  </Select>

                </div>

                <div>

                  <Label>{t("profile.assignments.position")}</Label>

                  <Select value={posId} onValueChange={setPosId}>

                    <SelectTrigger>

                      <SelectValue placeholder="—" />

                    </SelectTrigger>

                    <SelectContent>

                      <SelectItem value="none">—</SelectItem>

                      {(positions as { id: string; title_ru: string; title_kk: string }[]).map((p) => (

                        <SelectItem key={p.id} value={p.id}>

                          {localized(p, locale, "title")}

                        </SelectItem>

                      ))}

                    </SelectContent>

                  </Select>

                </div>

                <div>

                  <Label>{t("profile.assignments.manager")}</Label>

                  <Select value={managerId} onValueChange={setManagerId}>

                    <SelectTrigger>

                      <SelectValue placeholder="—" />

                    </SelectTrigger>

                    <SelectContent>

                      <SelectItem value="none">—</SelectItem>

                      {(users as { id: string; full_name_ru: string | null; email: string }[])

                        .filter((u) => u.id !== userId)

                        .map((u) => (

                          <SelectItem key={u.id} value={u.id}>

                            {u.full_name_ru || u.email}

                          </SelectItem>

                        ))}

                    </SelectContent>

                  </Select>

                </div>

                <div className="grid grid-cols-2 gap-2">

                  <div>

                    <Label>{t("profile.assignments.startDate")}</Label>

                    <Input

                      type="date"

                      value={startDate}

                      onChange={(e) => setStartDate(e.target.value)}

                    />

                  </div>

                  <div>

                    <Label>{t("profile.assignments.reason")}</Label>

                    <Select value={reason} onValueChange={setReason}>

                      <SelectTrigger>

                        <SelectValue />

                      </SelectTrigger>

                      <SelectContent>

                        {REASON_KEYS.map((k) => (

                          <SelectItem key={k} value={k}>

                            {reasonLabel(k)}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                </div>

                <div className="flex items-center gap-4">

                  <div className="flex items-center gap-2">

                    <Switch checked={isPrimary} onCheckedChange={setIsPrimary} id="prim" />

                    <Label htmlFor="prim">{t("profile.assignments.primary")}</Label>

                  </div>

                  <div className="flex items-center gap-2">

                    <Switch

                      checked={isTemporary}

                      onCheckedChange={setIsTemporary}

                      id="temp"

                    />

                    <Label htmlFor="temp">{t("profile.assignments.temporary")}</Label>

                  </div>

                </div>

                <div>

                  <Label>{t("profile.assignments.note")}</Label>

                  <Input value={note} onChange={(e) => setNote(e.target.value)} />

                </div>

              </div>

              <DialogFooter>

                <Button variant="ghost" onClick={() => setOpen(false)}>

                  {t("common.cancel")}

                </Button>

                <Button onClick={() => create.mutate()} disabled={create.isPending}>

                  {t("common.save")}

                </Button>

              </DialogFooter>

            </DialogContent>

          </Dialog>

        )}

      </CardHeader>

      <CardContent>

        {isLoading ? (

          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>

        ) : assignments.length === 0 ? (

          <p className="text-sm text-muted-foreground">{t("profile.assignments.empty")}</p>

        ) : (

          <div className="space-y-2">

            {(assignments as any[]).map((a) => (

              <div

                key={a.id}

                className="flex items-center justify-between text-sm border rounded-sm px-3 py-2"

              >

                <div className="flex-1">

                  <div className="font-medium">

                    {a.positions ? localized(a.positions, locale, "title") : "—"}{" "}

                    {a.departments && (

                      <span className="text-muted-foreground">

                        · {localized(a.departments, locale, "name")}

                      </span>

                    )}

                  </div>

                  <div className="text-xs text-muted-foreground">

                    {a.start_date}

                    {a.end_date ? ` — ${a.end_date}` : ` — ${t("profile.assignments.present")}`}

                    {a.is_primary && (

                      <Badge variant="secondary" className="ml-2">

                        {t("profile.assignments.primaryBadge")}

                      </Badge>

                    )}

                    {a.is_temporary && (

                      <Badge variant="outline" className="ml-1">

                        {t("profile.assignments.temporaryBadge")}

                      </Badge>

                    )}

                    {a.reason && (

                      <Badge variant="outline" className="ml-1">

                        {reasonLabel(a.reason)}

                      </Badge>

                    )}

                  </div>

                  {a.notes && <div className="text-xs italic">{a.notes}</div>}

                </div>

                {canManage && !a.end_date && a.is_primary && a.reason !== "termination" && (

                  <Button

                    variant="ghost"

                    size="icon"

                    onClick={() => close.mutate(endDate || undefined)}

                    title={t("profile.assignments.terminateTitle")}

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

