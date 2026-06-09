import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PENDING_TTL_MINUTES = 15;

export type LeaveDecisionPayload = {
  leave_id: string;
  decision: "approve" | "reject";
};

export type PendingAction = {
  chat_id: string;
  user_id: string;
  action: string;
  payload: LeaveDecisionPayload;
  message_id: number | null;
  expires_at: string;
};

export async function purgeExpiredPendingActions() {
  await supabaseAdmin
    .from("telegram_pending_actions" as never)
    .delete()
    .lt("expires_at", new Date().toISOString());
}

export async function setLeaveDecisionPending(
  chatId: string,
  userId: string,
  payload: LeaveDecisionPayload,
  messageId?: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + PENDING_TTL_MINUTES * 60_000).toISOString();
  await supabaseAdmin.from("telegram_pending_actions" as never).upsert(
    {
      chat_id: chatId,
      user_id: userId,
      action: "leave_decision",
      payload,
      message_id: messageId ?? null,
      expires_at: expiresAt,
    } as never,
    { onConflict: "chat_id" },
  );
}

export async function getPendingAction(chatId: string): Promise<PendingAction | null> {
  await purgeExpiredPendingActions();
  const { data, error } = await supabaseAdmin
    .from("telegram_pending_actions" as never)
    .select("chat_id, user_id, action, payload, message_id, expires_at")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date((data as PendingAction).expires_at) < new Date()) {
    await clearPendingAction(chatId);
    return null;
  }
  return data as PendingAction;
}

export async function clearPendingAction(chatId: string) {
  await supabaseAdmin.from("telegram_pending_actions" as never).delete().eq("chat_id", chatId);
}
