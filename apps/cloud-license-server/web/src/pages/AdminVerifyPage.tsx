import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  fetchAdminSession,
  pollAdminVerify,
  startAdminVerify,
  type VerifyStartResponse,
} from "../lib/admin-api";
import { useAdminSession } from "../hooks/useAdminSession";
import { supabase } from "../lib/supabase";

const CHALLENGE_STORAGE_KEY = "fm_admin_verify_challenge";

function loadStoredChallenge(email: string): VerifyStartResponse | null {
  try {
    const raw = sessionStorage.getItem(CHALLENGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VerifyStartResponse & { email?: string };
    if (parsed.email !== email || !parsed.token) return null;
    if (parsed.expires_at && new Date(parsed.expires_at) < new Date()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeChallenge(email: string, challenge: VerifyStartResponse) {
  sessionStorage.setItem(
    CHALLENGE_STORAGE_KEY,
    JSON.stringify({ ...challenge, email }),
  );
}

function clearStoredChallenge() {
  sessionStorage.removeItem(CHALLENGE_STORAGE_KEY);
}

export function AdminVerifyPage() {
  const { session, loading, refresh } = useAdminSession();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<VerifyStartResponse | null>(null);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const goToApp = useCallback(async () => {
    for (let i = 0; i < 8; i++) {
      const next = await fetchAdminSession();
      if (next.authenticated) {
        clearStoredChallenge();
        navigate("/admin/app", { replace: true });
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    await refresh();
    navigate("/admin/app", { replace: true });
  }, [navigate, refresh]);

  const runPoll = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;

    try {
      const result = await pollAdminVerify(token);
      if (result.ok) {
        stopPolling();
        setConfirmed(true);
        await goToApp();
        return;
      }
      if (result.status === "expired") {
        stopPolling();
        clearStoredChallenge();
        setChallenge(null);
        setError("Код подтверждения истёк. Страница обновится…");
        window.setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      console.warn("[admin-verify] poll failed", err);
    }
  }, [goToApp, stopPolling]);

  useEffect(() => {
    if (loading) return;
    if (!session?.configured) return;
    if (!session.identity) {
      navigate("/admin", { replace: true });
      return;
    }
    if (session.authenticated) {
      navigate("/admin/app", { replace: true });
      return;
    }
    if (!session.verify.required) {
      navigate("/admin/app", { replace: true });
    }
  }, [loading, navigate, session]);

  useEffect(() => {
    if (loading || !session?.identity || session.authenticated) return;
    if (challenge) return;

    const email = session.identity.email;
    const stored = loadStoredChallenge(email);
    if (stored) {
      setChallenge(stored);
      tokenRef.current = stored.token ?? null;
      return;
    }

    void (async () => {
      try {
        const started = await startAdminVerify();
        storeChallenge(email, started);
        setChallenge(started);
        tokenRef.current = started.token ?? null;
        if (started.skipped) {
          await refresh();
          navigate("/admin/app", { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [challenge, loading, navigate, refresh, session]);

  useEffect(() => {
    if (!challenge?.token || challenge.skipped) return;

    tokenRef.current = challenge.token;
    setPolling(true);
    void runPoll();

    pollRef.current = setInterval(() => {
      void runPoll();
    }, 1500);

    const onFocus = () => void runPoll();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runPoll();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopPolling();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [challenge, runPoll, stopPolling]);

  async function cancel() {
    stopPolling();
    clearStoredChallenge();
    if (supabase) await supabase.auth.signOut();
    navigate("/admin", { replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  if (!session?.identity) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-widest text-sky-400">Cloud Admin</p>
          <h1 className="mt-2 text-2xl font-bold">Подтверждение входа</h1>
          <p className="mt-2 text-sm text-slate-400">
            {session.identity.email} — подтвердите через кнопку ниже (не просто /start в боте).
          </p>
        </div>

        <div className="card space-y-4 p-6 text-sm">
          {challenge?.telegram?.enabled ? (
            <div>
              <h2 className="font-semibold text-white">
                Telegram
                {challenge.telegram.bot_username ? (
                  <span className="ml-2 font-normal text-sky-300">
                    @{challenge.telegram.bot_username}
                  </span>
                ) : null}
              </h2>
              <p className="mt-1 text-slate-400">
                Нажмите <strong>«Открыть Telegram»</strong> — откроется бот с кодом подтверждения.
                Обычный /start без ссылки не сработает.
              </p>
              {challenge.telegram.deep_link ? (
                <a
                  href={challenge.telegram.deep_link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary mt-3 inline-flex w-full justify-center"
                >
                  Открыть Telegram
                </a>
              ) : (
                <p className="mt-2 font-mono text-xs text-slate-500">
                  /start {challenge.telegram.start_command}
                </p>
              )}
            </div>
          ) : null}

          {challenge?.webhook?.enabled ? (
            <div className={challenge.telegram?.enabled ? "border-t border-white/10 pt-4" : ""}>
              <h2 className="font-semibold text-white">Webhook</h2>
              <p className="mt-1 text-slate-400">
                {challenge.webhook.dispatched
                  ? "Запрос отправлен во внутреннюю систему. Ожидайте подтверждения."
                  : "Webhook настроен, но запрос не доставлен."}
              </p>
            </div>
          ) : null}

          {polling && !confirmed ? (
            <p className="text-center text-slate-500">Ожидание подтверждения в Telegram…</p>
          ) : null}

          {confirmed ? (
            <p className="text-center text-emerald-400">Подтверждено. Переход в админку…</p>
          ) : null}

          {error ? <p className="text-red-400">{error}</p> : null}

          <button type="button" onClick={() => void runPoll()} className="btn-secondary w-full">
            Я подтвердил в Telegram
          </button>

          <button type="button" onClick={() => void cancel()} className="btn-secondary w-full">
            Отмена
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link to="/" className="text-sky-300 hover:underline">
            ← На сайт
          </Link>
        </p>
      </div>
    </div>
  );
}
