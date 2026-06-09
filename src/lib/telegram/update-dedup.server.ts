import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TelegramUpdate } from "./api.server";

const SEEN_TTL_MS = 10 * 60_000;
const MAX_SEEN = 2000;

type Globals = typeof globalThis & {
  __flowmasterTelegramSeenUpdates?: Map<number, number>;
};

function memorySeen(): Map<number, number> {
  const g = globalThis as Globals;
  if (!g.__flowmasterTelegramSeenUpdates) {
    g.__flowmasterTelegramSeenUpdates = new Map();
  }
  return g.__flowmasterTelegramSeenUpdates;
}

function isMemoryDuplicate(updateId: number): boolean {
  const map = memorySeen();
  const now = Date.now();
  if (map.has(updateId)) return true;
  map.set(updateId, now);
  if (map.size > MAX_SEEN) {
    for (const [id, ts] of map) {
      if (now - ts > SEEN_TTL_MS) map.delete(id);
    }
  }
  return false;
}

/** Returns true if this update was already handled and should be skipped. */
export async function claimTelegramUpdate(update: TelegramUpdate): Promise<boolean> {
  const updateId = update.update_id;
  if (updateId == null) return false;

  if (isMemoryDuplicate(updateId)) return true;

  const chatId =
    update.message?.chat?.id != null
      ? String(update.message.chat.id)
      : update.callback_query?.message?.chat?.id != null
        ? String(update.callback_query.message.chat.id)
        : null;
  const messageId =
    update.message?.message_id ?? update.callback_query?.message?.message_id ?? null;

  const { error } = await supabaseAdmin.from("telegram_processed_updates" as never).insert({
    update_id: updateId,
    chat_id: chatId,
    message_id: messageId,
  } as never);

  if (!error) {
    void pruneOldTelegramUpdates();
    return false;
  }

  if (error.code === "23505") return true;

  console.warn("[telegram] update dedup db unavailable, using memory only:", error.message);
  return false;
}

async function pruneOldTelegramUpdates() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await supabaseAdmin
    .from("telegram_processed_updates" as never)
    .delete()
    .lt("processed_at", cutoff);
}
