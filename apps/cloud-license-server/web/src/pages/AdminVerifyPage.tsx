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

export function AdminVerifyPage() {
  const { session, loading, refresh } = useAdminSession();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<VerifyStartResponse | null>(null);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

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

    void (async () => {
      try {
        const started = await startAdminVerify();
        setChallenge(started);
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

    setPolling(true);
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const result = await pollAdminVerify(challenge.token!);
          if (result.ok) {
            stopPolling();
            await refresh();
            navigate("/admin/app", { replace: true });
          } else if (result.status === "expired") {
            stopPolling();
            setError("Код подтверждения истёк. Обновите страницу.");
          }
        } catch {
          /* keep polling */
        }
      })();
    }, 2000);

    return () => stopPolling();
  }, [challenge, navigate, refresh, stopPolling]);

  async function cancel() {
    stopPolling();
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
            {session.identity.email} — второй шаг: Telegram или webhook вашей инфраструктуры.
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
                Откройте <strong>бот вендора</strong> (отдельный от EDMS клиента) и подтвердите
                вход по ссылке ниже.
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
                  : "Webhook настроен, но запрос не доставлен. Подтвердите через Telegram или проверьте URL."}
              </p>
            </div>
          ) : null}

          {polling ? (
            <p className="text-center text-slate-500">Ожидание подтверждения…</p>
          ) : null}

          {error ? <p className="text-red-400">{error}</p> : null}

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
