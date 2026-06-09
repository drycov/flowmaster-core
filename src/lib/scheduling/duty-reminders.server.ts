import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "@/lib/logger.server";

type DutyRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  assignee_id: string;
  substitute_id: string | null;
  note: string | null;
  ref_duty_roles?: { name_ru?: string } | null;
  departments?: { code?: string; name_ru?: string } | null;
};

function tomorrowYmd(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatPeriod(startsAt: string, endsAt: string): string {
  const start = startsAt.slice(0, 10);
  const end = endsAt.slice(0, 10);
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU");
  return start === end ? fmt(start) : `${fmt(start)} — ${fmt(end)}`;
}

async function alreadyReminded(
  dutyId: string,
  userId: string,
  remindedOn: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("duty_reminder_log" as never)
    .select("duty_assignment_id")
    .eq("duty_assignment_id", dutyId)
    .eq("user_id", userId)
    .eq("reminded_on", remindedOn)
    .maybeSingle();
  return !!data;
}

async function markReminded(dutyId: string, userId: string, remindedOn: string) {
  await supabaseAdmin.from("duty_reminder_log" as never).insert({
    duty_assignment_id: dutyId,
    user_id: userId,
    reminded_on: remindedOn,
  } as never);
}

async function notifyUser(
  userId: string,
  title: string,
  body: string,
  asSubstitute: boolean,
) {
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "hr",
    title: asSubstitute ? `Завтра замещение: ${title}` : `Завтра дежурство: ${title}`,
    body,
    link: "/hr/duty",
  } as never);
}

export async function processDutyReminders() {
  const tomorrow = tomorrowYmd();
  const today = todayYmd();

  const { data: rows, error } = await supabaseAdmin
    .from("duty_assignments" as never)
    .select(
      `id, starts_at, ends_at, assignee_id, substitute_id, note,
       ref_duty_roles!duty_assignments_duty_role_id_fkey(name_ru),
       departments!duty_assignments_department_id_fkey(code, name_ru)`,
    )
    .in("status", ["scheduled", "confirmed"])
    .gte("starts_at", `${tomorrow}T00:00:00Z`)
    .lt("starts_at", `${tomorrow}T23:59:59.999Z`);

  if (error) throw new Error(error.message);

  let sent = 0;
  let skipped = 0;

  for (const raw of rows ?? []) {
    const duty = raw as DutyRow;
    const role = duty.ref_duty_roles?.name_ru ?? "Дежурство";
    const dept = duty.departments?.code ?? duty.departments?.name_ru ?? "";
    const period = formatPeriod(duty.starts_at, duty.ends_at);
    const body = [period, dept, duty.note?.trim()].filter(Boolean).join(" · ");

    const targets: Array<{ userId: string; substitute: boolean }> = [
      { userId: duty.assignee_id, substitute: false },
    ];
    if (duty.substitute_id && duty.substitute_id !== duty.assignee_id) {
      targets.push({ userId: duty.substitute_id, substitute: true });
    }

    for (const target of targets) {
      if (await alreadyReminded(duty.id, target.userId, today)) {
        skipped++;
        continue;
      }
      await notifyUser(target.userId, role, body, target.substitute);
      await markReminded(duty.id, target.userId, today);
      sent++;
    }
  }

  if (sent > 0) {
    logger.info("duty reminders processed", { sent, skipped, tomorrow });
  }

  return { sent, skipped, tomorrow };
}
