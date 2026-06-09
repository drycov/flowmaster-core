import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

import { getAccessToken } from "@/lib/auth/session-storage";

function createSupabaseClient() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),

      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];

    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in .env.`;

    console.error(`[Supabase] ${message}`);

    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,

      autoRefreshToken: false,

      detectSessionInUrl: false,

      storageKey: "flowmaster-db-client",
    },

    global: {
      fetch: async (url, options = {}) => {
        const token = typeof window !== "undefined" ? getAccessToken() : null;

        const headers = new Headers(options.headers);

        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        return fetch(url, { ...options, headers });
      },
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

/** @deprecated Singleton uses per-request token; no client recreation needed */
export function resetSupabaseClient() {}

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();

    return Reflect.get(_supabase, prop, receiver);
  },
});
