import { createFileRoute } from "@tanstack/react-router";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useState } from "react";

import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { toast } from "sonner";

import { PageHeader, PageBody } from "@/components/AppShell";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useI18n } from "@/i18n";

import { requireModule } from "@/lib/access/route-guards";

import {

  deleteBusinessCalendarDay,

  listBusinessCalendarDays,

  upsertBusinessCalendarDay,

} from "@/lib/api/calendar.functions";

import { BusinessCalendarGrid } from "@/components/calendar/BusinessCalendarGrid";

import { BusinessDayEditDialog } from "@/components/calendar/BusinessDayEditDialog";

import {

  isWeekend,

  parseDateKey,

  type CalendarDayRecord,

} from "@/components/calendar/business-calendar-utils";



export const Route = createFileRoute("/_authenticated/admin/calendar")({

  beforeLoad: () => requireModule("admin_org"),

  component: BusinessCalendarPage,

});



function BusinessCalendarPage() {

  const { t } = useI18n();

  const qc = useQueryClient();

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());

  const [month, setMonth] = useState(now.getMonth());



  const [editOpen, setEditOpen] = useState(false);

  const [editDate, setEditDate] = useState<string | null>(null);

  const [editHoliday, setEditHoliday] = useState(true);

  const [editNameRu, setEditNameRu] = useState("");

  const [editNameKk, setEditNameKk] = useState("");

  const [editHasOverride, setEditHasOverride] = useState(false);



  const { data: days = [], isLoading } = useQuery({

    queryKey: ["business-calendar", year],

    queryFn: () => listBusinessCalendarDays({ data: { year } }),

  });



  const saveMutation = useMutation({

    mutationFn: () =>

      upsertBusinessCalendarDay({

        data: {

          day_date: editDate!,

          is_holiday: editHoliday,

          name_ru: editNameRu,

          name_kk: editNameKk,

        },

      }),

    onSuccess: () => {

      toast.success(t("calendar.saved"));

      setEditOpen(false);

      qc.invalidateQueries({ queryKey: ["business-calendar", year] });

    },

    onError: (e) => toast.error(e instanceof Error ? e.message : t("calendar.error")),

  });



  const deleteMutation = useMutation({

    mutationFn: (d: string) => deleteBusinessCalendarDay({ data: { day_date: d } }),

    onSuccess: () => {

      toast.success(t("calendar.resetDone"));

      setEditOpen(false);

      qc.invalidateQueries({ queryKey: ["business-calendar", year] });

    },

    onError: (e) => toast.error(e instanceof Error ? e.message : t("calendar.error")),

  });



  const handleYearMonthChange = (y: number, m: number) => {

    if (y !== year) setYear(y);

    setMonth(m);

  };



  const openDayEditor = (dateKey: string, record?: CalendarDayRecord) => {

    setEditDate(dateKey);

    if (record) {

      setEditHoliday(record.is_holiday);

      setEditNameRu(record.name_ru);

      setEditNameKk(record.name_kk);

      setEditHasOverride(true);

    } else {

      const weekend = isWeekend(parseDateKey(dateKey));

      setEditHoliday(!weekend);

      setEditNameRu("");

      setEditNameKk("");

      setEditHasOverride(false);

    }

    setEditOpen(true);

  };



  return (

    <>

      <PageHeader title={t("calendar.title")} description={t("calendar.subtitle")} />

      <PageBody>

        <div className="max-w-4xl mx-auto space-y-6">

          <Card>

            <CardHeader className="flex flex-row items-center justify-between gap-4">

              <CardTitle className="text-sm flex items-center gap-2">

                <CalendarDays className="w-4 h-4" />

                {t("calendar.year")} {year}

              </CardTitle>

              <div className="flex items-center gap-1">

                <Button

                  type="button"

                  size="icon"

                  variant="outline"

                  onClick={() => setYear((y) => y - 1)}

                >

                  <ChevronLeft className="w-4 h-4" />

                </Button>

                <Button

                  type="button"

                  size="icon"

                  variant="outline"

                  onClick={() => setYear((y) => y + 1)}

                >

                  <ChevronRight className="w-4 h-4" />

                </Button>

              </div>

            </CardHeader>

            <CardContent>

              {isLoading ? (

                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">

                  <Loader2 className="w-4 h-4 animate-spin" />

                  {t("common.loading")}

                </div>

              ) : (

                <BusinessCalendarGrid

                  year={year}

                  month={month}

                  days={days}

                  onYearMonthChange={handleYearMonthChange}

                  onDayClick={openDayEditor}

                />

              )}

              <p className="text-xs text-muted-foreground mt-4">{t("calendar.clickHint")}</p>

            </CardContent>

          </Card>

        </div>

      </PageBody>



      <BusinessDayEditDialog

        open={editOpen}

        dayDate={editDate}

        isHoliday={editHoliday}

        nameRu={editNameRu}

        nameKk={editNameKk}

        hasOverride={editHasOverride}

        saving={saveMutation.isPending || deleteMutation.isPending}

        onOpenChange={setEditOpen}

        onIsHolidayChange={setEditHoliday}

        onNameRuChange={setEditNameRu}

        onNameKkChange={setEditNameKk}

        onSave={() => saveMutation.mutate()}

        onReset={() => editDate && deleteMutation.mutate(editDate)}

      />

    </>

  );

}

