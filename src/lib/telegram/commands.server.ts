import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAppOrigin } from "@/lib/app-origin.server";
import { callTelegramApi } from "./api.server";
import {
  clearPendingAction,
  getPendingAction,
  setLeaveDecisionPending,
  type LeaveDecisionPayload,
} from "./pending-actions.server";

const TASK_LIMIT = 8;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function findLinkedUserId(chatId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_notification_preferences")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data?.user_id ?? null;
}

export async function listPendingTasksForChat(chatId: string): Promise<string> {
  const userId = await findLinkedUserId(chatId);
  if (!userId) {
    return "❌ Чат не привязан к аккаунту.\nПривяжите бота в ЕСЭДО → Профиль → Telegram.";
  }

  const now = new Date().toISOString();
  const { data: subs } = await supabaseAdmin
    .from("user_substitutions")
    .select("principal_id")
    .eq("substitute_id", userId)
    .eq("is_active", true)
    .lte("valid_from", now)
    .gte("valid_until", now);

  const principalIds = (subs ?? []).map((s) => s.principal_id as string);
  let q = supabaseAdmin
    .from("workflow_tasks")
    .select("id, title, status, due_at, assignee_id, documents(reg_number, title_ru)")
    .in("status", ["pending", "in_progress"])
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(TASK_LIMIT);

  if (principalIds.length > 0) {
    q = q.or(`assignee_id.eq.${userId},assignee_id.in.(${principalIds.join(",")})`);
  } else {
    q = q.eq("assignee_id", userId);
  }

  const { data: tasks, error } = await q;
  if (error) {
    return "❌ Не удалось загрузить задачи. Попробуйте позже.";
  }

  if (!tasks?.length) {
    return "✅ Нет активных задач в очереди.";
  }

  const origin = await resolveAppOrigin();
  const lines = [`<b>📋 Активные задачи</b> (${tasks.length})`, ""];

  for (const raw of tasks) {
    const task = raw as {
      id: string;
      title?: string | null;
      status: string;
      due_at?: string | null;
      assignee_id: string;
      documents?: { reg_number?: string | null; title_ru?: string | null } | null;
    };
    const doc = task.documents;
    const label =
      doc?.reg_number && doc?.title_ru
        ? `${doc.reg_number} — ${doc.title_ru}`
        : task.title || doc?.title_ru || "Задача";
    const sub = task.assignee_id !== userId ? " (замещение)" : "";
    const due = task.due_at
      ? ` · до ${new Date(task.due_at).toLocaleDateString("ru-RU")}`
      : "";
    lines.push(`• <b>${escapeHtml(label)}</b>${sub}${due}`);
  }

  if (origin) {
    lines.push("", `<a href="${origin}/tasks">Открыть все задачи в ЕСЭДО</a>`);
  }
  if (tasks.length >= TASK_LIMIT) {
    lines.push(`<i>Показаны первые ${TASK_LIMIT}.</i>`);
  }

  return lines.join("\n");
}

export async function buildAccountStatusForChat(chatId: string): Promise<string> {
  const { data: pref } = await supabaseAdmin
    .from("user_notification_preferences")
    .select(
      "user_id, telegram_enabled, telegram_task_assigned, telegram_workflow_events, telegram_document_returned, telegram_hr_events, telegram_linked_at",
    )
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (!pref?.user_id) {
    return "❌ Аккаунт не привязан.\nПривяжите бота в ЕСЭДО → Профиль → Telegram.";
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name_ru, email")
    .eq("id", pref.user_id)
    .maybeSingle();

  const name = profile?.full_name_ru || profile?.email || "—";
  const on = (v: boolean | null | undefined) => (v !== false ? "✅" : "❌");

  return [
    "<b>👤 Статус аккаунта</b>",
    "",
    `Пользователь: <b>${escapeHtml(name)}</b>`,
    pref.telegram_linked_at
      ? `Привязан: ${new Date(pref.telegram_linked_at).toLocaleString("ru-RU")}`
      : "",
    "",
    "<b>Уведомления</b>",
    `${on(pref.telegram_enabled)} Общий переключатель`,
    `${on(pref.telegram_task_assigned)} Новые задачи`,
    `${on(pref.telegram_workflow_events)} События маршрута`,
    `${on(pref.telegram_document_returned)} Возврат документа`,
    `${on((pref as { telegram_hr_events?: boolean }).telegram_hr_events)} Отпуска и дежурства`,
    "",
    "Управление уведомлениями: кнопка «⚙️ Настройки» в меню.",
  ]
    .filter(Boolean)
    .join("\n");
}

function monthBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

function formatDateRu(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU");
}

export async function listMyDutyForChat(chatId: string): Promise<string> {
  const userId = await findLinkedUserId(chatId);
  if (!userId) {
    return "❌ Чат не привязан к аккаунту.\nПривяжите бота в ЕСЭДО → Профиль → Telegram.";
  }

  const { from, to } = monthBounds();
  const { data: rows, error } = await supabaseAdmin
    .from("duty_assignments" as never)
    .select(
      `id, starts_at, ends_at, status, note,
       ref_duty_roles!duty_assignments_duty_role_id_fkey(name_ru, color),
       departments!duty_assignments_department_id_fkey(code, name_ru),
       assignee_id, substitute_id`,
    )
    .or(`assignee_id.eq.${userId},substitute_id.eq.${userId}`)
    .lte("starts_at", `${to}T23:59:59Z`)
    .gte("ends_at", `${from}T00:00:00Z`)
    .neq("status", "cancelled")
    .order("starts_at")
    .limit(12);

  if (error) return "❌ Не удалось загрузить график дежурств.";

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (rows ?? []).filter((r) => String((r as { ends_at: string }).ends_at).slice(0, 10) >= today);

  if (!upcoming.length) {
    const origin = await resolveAppOrigin();
    const tail = origin ? `\n\n<a href="${origin}/hr/duty">Открыть график дежурств</a>` : "";
    return `✅ Ближайших дежурств нет.${tail}`;
  }

  const origin = await resolveAppOrigin();
  const lines = ["<b>🛡 График дежурств</b>", ""];

  for (const raw of upcoming) {
    const d = raw as {
      starts_at: string;
      ends_at: string;
      status: string;
      note?: string | null;
      assignee_id: string;
      substitute_id?: string | null;
      ref_duty_roles?: { name_ru?: string } | null;
      departments?: { code?: string; name_ru?: string } | null;
    };
    const role = d.ref_duty_roles?.name_ru ?? "Дежурство";
    const dept = d.departments?.code ?? d.departments?.name_ru ?? "";
    const start = formatDateRu(d.starts_at);
    const end = formatDateRu(d.ends_at);
    const range = start === end ? start : `${start} — ${end}`;
    const sub = d.substitute_id === userId && d.assignee_id !== userId ? " (замещение)" : "";
    lines.push(`• <b>${escapeHtml(role)}</b>${sub}${dept ? ` · ${escapeHtml(dept)}` : ""}`);
    lines.push(`  ${range}`);
    if (d.note?.trim()) lines.push(`  <i>${escapeHtml(d.note.trim())}</i>`);
  }

  if (origin) lines.push("", `<a href="${origin}/hr/duty">Открыть в ЕСЭДО</a>`);
  return lines.join("\n");
}

export async function listMyLeaveForChat(chatId: string): Promise<string> {
  const userId = await findLinkedUserId(chatId);
  if (!userId) {
    return "❌ Чат не привязан к аккаунту.\nПривяжите бота в ЕСЭДО → Профиль → Telegram.";
  }

  const year = new Date().getFullYear();
  const { data: balanceRow } = await supabaseAdmin
    .from("leave_balances" as never)
    .select("entitled_days, used_days")
    .eq("user_id", userId)
    .eq("year", year)
    .maybeSingle();

  const entitled = (balanceRow as { entitled_days?: number } | null)?.entitled_days ?? 24;
  const used = (balanceRow as { used_days?: number } | null)?.used_days ?? 0;
  const remaining = Math.max(entitled - used, 0);

  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await supabaseAdmin
    .from("leave_requests" as never)
    .select(
      `id, date_from, date_to, business_days, status, reason,
       ref_absence_types!leave_requests_absence_type_id_fkey(name_ru, color)`,
    )
    .eq("user_id", userId)
    .in("status", ["approved", "pending"])
    .gte("date_to", today)
    .order("date_from")
    .limit(10);

  if (error) return "❌ Не удалось загрузить отпуска.";

  const origin = await resolveAppOrigin();
  const lines = [
    "<b>🏖 Отпуска и отсутствия</b>",
    "",
    `Баланс ${year}: <b>${remaining}</b> из ${entitled} дн.`,
    "",
  ];

  if (!rows?.length) {
    lines.push("Ближайших отпусков нет.");
  } else {
    lines.push("<b>Ближайшие:</b>");
    for (const raw of rows) {
      const d = raw as {
        date_from: string;
        date_to: string;
        business_days?: number;
        status: string;
        reason?: string | null;
        ref_absence_types?: { name_ru?: string } | null;
      };
      const type = d.ref_absence_types?.name_ru ?? "Отсутствие";
      const start = formatDateRu(d.date_from);
      const end = formatDateRu(d.date_to);
      const range = start === end ? start : `${start} — ${end}`;
      const days = d.business_days ? ` · ${d.business_days} раб. дн.` : "";
      const status =
        d.status === "pending" ? " ⏳ на согласовании" : d.status === "approved" ? " ✅" : "";
      lines.push(`• <b>${escapeHtml(type)}</b>${status}`);
      lines.push(`  ${range}${days}`);
    }
  }

  if (origin) {
    lines.push("", `<a href="${origin}/hr/leave">Заявки</a> · <a href="${origin}/hr/leave/schedule">График</a>`);
  }
  return lines.join("\n");
}

export type LeaveCallbackResult = {
  ok: boolean;
  message: string;
  callbackQueryId: string;
  chatId?: string;
  messageId?: number;
  awaitingComment?: boolean;
};

type LeaveRow = {
  id: string;
  status: string;
  approver_id: string | null;
  date_from: string;
  date_to: string;
  ref_absence_types?: { name_ru?: string } | null;
};

async function canDecideLeave(userId: string, leave: LeaveRow): Promise<boolean> {
  if (leave.approver_id === userId) return true;
  const { data: canHr } = await supabaseAdmin.rpc("user_has_permission" as never, {
    _user: userId,
    _permission: "manage_hr",
  } as never);
  return !!canHr;
}

async function loadPendingLeave(leaveId: string): Promise<LeaveRow | null> {
  const { data: row, error } = await supabaseAdmin
    .from("leave_requests" as never)
    .select("id, status, approver_id, date_from, date_to, ref_absence_types(name_ru)")
    .eq("id", leaveId)
    .maybeSingle();
  if (error || !row) return null;
  return row as LeaveRow;
}

function formatLeavePeriod(leave: LeaveRow): string {
  return `${formatDateRu(leave.date_from)}${
    leave.date_to !== leave.date_from ? ` — ${formatDateRu(leave.date_to)}` : ""
  }`;
}

function normalizeDecisionComment(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-" || trimmed.toLowerCase() === "/skip") {
    return null;
  }
  return trimmed.slice(0, 1000);
}

export async function handleLeaveApprovalCallback(
  callbackQueryId: string,
  chatId: string,
  messageId: number | undefined,
  data: string,
): Promise<LeaveCallbackResult> {
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== "leave" || !["approve", "reject"].includes(parts[1] ?? "")) {
    return {
      ok: false,
      message: "❌ Некорректная команда.",
      callbackQueryId,
      chatId,
      messageId,
    };
  }

  const decision = parts[1] as "approve" | "reject";
  const leaveId = parts[2] ?? "";
  const userId = await findLinkedUserId(chatId);
  if (!userId) {
    return {
      ok: false,
      message: "❌ Чат не привязан к аккаунту.",
      callbackQueryId,
      chatId,
      messageId,
    };
  }

  const leave = await loadPendingLeave(leaveId);
  if (!leave) {
    return {
      ok: false,
      message: "❌ Заявка не найдена.",
      callbackQueryId,
      chatId,
      messageId,
    };
  }

  if (leave.status !== "pending") {
    return {
      ok: false,
      message: "ℹ️ Заявка уже обработана.",
      callbackQueryId,
      chatId,
      messageId,
    };
  }

  if (!(await canDecideLeave(userId, leave))) {
    return {
      ok: false,
      message: "❌ Нет прав на согласование этой заявки.",
      callbackQueryId,
      chatId,
      messageId,
    };
  }

  await setLeaveDecisionPending(
    chatId,
    userId,
    { leave_id: leaveId, decision },
    messageId,
  );

  const typeName = leave.ref_absence_types?.name_ru ?? "Отсутствие";
  const actionLabel = decision === "approve" ? "согласование" : "отклонение";

  return {
    ok: true,
    awaitingComment: true,
    message: [
      `<b>${decision === "approve" ? "✅ Согласование" : "❌ Отклонение"}</b>`,
      `<b>${escapeHtml(typeName)}</b>`,
      formatLeavePeriod(leave),
      "",
      `Введите комментарий к ${actionLabel} или отправьте <code>—</code> чтобы пропустить.`,
      "Отмена: кнопка «↩️ Отмена» ниже.",
    ].join("\n"),
    callbackQueryId,
    chatId,
    messageId,
  };
}

export async function completeLeaveDecisionFromChat(
  chatId: string,
  commentText: string,
): Promise<{ handled: boolean; message: string }> {
  const pending = await getPendingAction(chatId);
  if (!pending || pending.action !== "leave_decision") {
    return { handled: false, message: "" };
  }

  const payload = pending.payload as LeaveDecisionPayload;
  const leave = await loadPendingLeave(payload.leave_id);
  if (!leave || leave.status !== "pending") {
    await clearPendingAction(chatId);
    return { handled: true, message: "ℹ️ Заявка уже обработана или недоступна." };
  }

  if (!(await canDecideLeave(pending.user_id, leave))) {
    await clearPendingAction(chatId);
    return { handled: true, message: "❌ Нет прав на согласование этой заявки." };
  }

  const note = normalizeDecisionComment(commentText);
  const newStatus = payload.decision === "approve" ? "approved" : "rejected";
  const defaultNote =
    payload.decision === "approve" ? "Согласовано в Telegram" : "Отклонено в Telegram";

  const { error: updErr } = await supabaseAdmin
    .from("leave_requests" as never)
    .update({
      status: newStatus,
      decided_at: new Date().toISOString(),
      decision_note: note ?? defaultNote,
    } as never)
    .eq("id", payload.leave_id)
    .eq("status", "pending");

  await clearPendingAction(chatId);

  if (updErr) {
    return { handled: true, message: "❌ Не удалось сохранить решение." };
  }

  const typeName = leave.ref_absence_types?.name_ru ?? "Отсутствие";
  const label = payload.decision === "approve" ? "✅ Согласовано" : "❌ Отклонено";
  const lines = [`${label}`, `<b>${escapeHtml(typeName)}</b>`, formatLeavePeriod(leave)];
  if (note) lines.push("", `<i>${escapeHtml(note)}</i>`);

  return { handled: true, message: lines.join("\n") };
}

export async function cancelPendingActionFromChat(chatId: string): Promise<boolean> {
  const pending = await getPendingAction(chatId);
  if (!pending) return false;
  await clearPendingAction(chatId);
  return true;
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text?.slice(0, 200),
    show_alert: text ? text.length > 80 : false,
  });
}

export async function editTelegramMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  await callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function clearTelegramInlineKeyboard(
  chatId: string,
  messageId: number,
): Promise<void> {
  await callTelegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function setTelegramNotificationsForChat(
  chatId: string,
  enabled: boolean,
): Promise<string> {
  const userId = await findLinkedUserId(chatId);
  if (!userId) {
    return "❌ Чат не привязан к аккаунту.";
  }

  const { error } = await supabaseAdmin.from("user_notification_preferences").upsert(
    {
      user_id: userId,
      telegram_enabled: enabled,
    } as never,
    { onConflict: "user_id" },
  );

  if (error) return "❌ Не удалось обновить настройки.";

  return enabled
    ? "🔔 Уведомления в Telegram включены."
    : "🔕 Уведомления в Telegram отключены. Команды бота по-прежнему работают.";
}
