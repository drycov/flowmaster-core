import { loadSystemSettings } from "@/lib/auth/policy";
import { callTelegramApi, type TelegramUpdate } from "./api.server";
import { handleTelegramUpdate } from "./bot.server";

type PollGlobals = typeof globalThis & {
  __flowmasterTelegramPoll?: {
    pollOffset: number;
    pollingActive: boolean;
    pollingLoopPromise: Promise<void> | null;
    pollMutex: Promise<void>;
  };
};

function pollState() {
  const g = globalThis as PollGlobals;
  if (!g.__flowmasterTelegramPoll) {
    g.__flowmasterTelegramPoll = {
      pollOffset: 0,
      pollingActive: false,
      pollingLoopPromise: null,
      pollMutex: Promise.resolve(),
    };
  }
  return g.__flowmasterTelegramPoll;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withPollMutex<T>(fn: () => Promise<T>): Promise<T> {
  const state = pollState();
  const run = state.pollMutex.then(fn, fn);
  state.pollMutex = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function isTelegramWebhookActive(): Promise<boolean> {
  const info = await callTelegramApi<{ url?: string }>("getWebhookInfo");
  if (!info.ok) return false;
  return !!info.result?.url?.trim();
}

export type TelegramDeliveryMode = "webhook" | "polling" | "off";

export async function getTelegramDeliveryMode(): Promise<TelegramDeliveryMode> {
  const { telegram } = await loadSystemSettings();
  if (!telegram.bot_token) return "off";
  if (await isTelegramWebhookActive()) return "webhook";
  return "polling";
}

export async function pollTelegramUpdatesOnce(timeoutSec = 25): Promise<number> {
  if (await isTelegramWebhookActive()) return 0;

  return withPollMutex(async () => {
    if (await isTelegramWebhookActive()) return 0;

    const state = pollState();
    const result = await callTelegramApi<TelegramUpdate[]>("getUpdates", {
      offset: state.pollOffset,
      timeout: timeoutSec,
      allowed_updates: ["message"],
    });

    if (!result.ok || !result.result?.length) {
      return 0;
    }

    let processed = 0;
    for (const update of result.result) {
      state.pollOffset = Math.max(state.pollOffset, update.update_id + 1);
      await handleTelegramUpdate(update);
      processed++;
    }
    return processed;
  });
}

export function stopTelegramPolling() {
  pollState().pollingActive = false;
}

async function runPollingLoop() {
  const state = pollState();
  while (state.pollingActive) {
    if (await isTelegramWebhookActive()) {
      stopTelegramPolling();
      return;
    }

    try {
      await pollTelegramUpdatesOnce(25);
    } catch (error) {
      const { logger } = await import("@/lib/logger.server");
      logger.error("telegram poll error", {
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(3000);
    }
  }
}

export function shouldStartTelegramPolling(): boolean {
  if (process.env.DISABLE_TELEGRAM_POLLING === "true") return false;
  const replicas = Number(process.env.REPLICA_COUNT ?? process.env.INSTANCE_COUNT ?? "1");
  if (Number.isFinite(replicas) && replicas > 1) return false;
  return true;
}

/** Long-polling loop while webhook is not registered. Safe to call multiple times. */
export function ensureTelegramPolling(): Promise<void> {
  const state = pollState();
  if (state.pollingLoopPromise) return state.pollingLoopPromise;

  if (!shouldStartTelegramPolling()) {
    return Promise.resolve();
  }

  state.pollingActive = true;
  state.pollingLoopPromise = (async () => {
    try {
      const { telegram } = await loadSystemSettings();
      if (!telegram.bot_token) return;
      if (await isTelegramWebhookActive()) return;

      const { logger } = await import("@/lib/logger.server");
      logger.info("telegram long polling started", { mode: "polling" });
      await runPollingLoop();
    } finally {
      state.pollingLoopPromise = null;
      state.pollingActive = false;
    }
  })();

  return state.pollingLoopPromise;
}
