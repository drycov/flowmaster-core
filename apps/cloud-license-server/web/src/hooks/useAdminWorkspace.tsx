import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchAdminActivations,
  fetchAdminClients,
  fetchAdminKeys,
  fetchAdminOverview,
  fetchAdminProvisions,
  generateKey,
  provisionInstallation,
  registerKey,
  revokeTarget,
  type ActivationRow,
  type AdminOverview,
  type ClientRow,
  type KeyRow,
  type LicensePlan,
  type ProvisionRow,
} from "../lib/admin-api";

type AdminWorkspace = {
  loading: boolean;
  busy: boolean;
  error: string;
  message: string;
  overview: AdminOverview | null;
  clients: ClientRow[];
  provisions: ProvisionRow[];
  keys: KeyRow[];
  activations: ActivationRow[];
  reload: () => Promise<void>;
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
  revokeInstallation: (installationId: string) => Promise<void>;
  createProvision: (body: {
    installation_id: string;
    plan: LicensePlan;
    max_users?: number;
    customer_name?: string;
  }) => Promise<void>;
  createKey: (body: {
    installation_id: string;
    plan: LicensePlan;
    max_users?: number;
    customer?: string;
  }) => Promise<string>;
  registerFm1Key: (licenseKey: string) => Promise<void>;
};

const Ctx = createContext<AdminWorkspace | null>(null);

export function AdminWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [provisions, setProvisions] = useState<ProvisionRow[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [activations, setActivations] = useState<ActivationRow[]>([]);

  const reload = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [ov, cl, prov, k, act] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminClients(),
        fetchAdminProvisions(),
        fetchAdminKeys(),
        fetchAdminActivations(),
      ]);
      setOverview(ov);
      setClients(cl.items);
      setProvisions(prov.items);
      setKeys(k.items);
      setActivations(act.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const revokeInstallation = useCallback(
    async (installationId: string) => {
      const result = await revokeTarget({
        installation_id: installationId,
        reason: "Отозвано вендором",
      });
      setMessage(`Отозвано: ключей ${result.revoked_keys}, активаций ${result.revoked_activations}`);
      await reload();
    },
    [reload],
  );

  const createProvision = useCallback(
    async (body: {
      installation_id: string;
      plan: LicensePlan;
      max_users?: number;
      customer_name?: string;
    }) => {
      await provisionInstallation(body);
      setMessage("Установка зарегистрирована");
      await reload();
    },
    [reload],
  );

  const createKey = useCallback(
    async (body: {
      installation_id: string;
      plan: LicensePlan;
      max_users?: number;
      customer?: string;
    }) => {
      const result = await generateKey(body);
      setMessage("FM1-ключ создан");
      await reload();
      return result.license_key;
    },
    [reload],
  );

  const registerFm1Key = useCallback(
    async (licenseKey: string) => {
      await registerKey(licenseKey);
      setMessage("Ключ зарегистрирован");
      await reload();
    },
    [reload],
  );

  const value = useMemo(
    () => ({
      loading,
      busy,
      error,
      message,
      overview,
      clients,
      provisions,
      keys,
      activations,
      reload,
      setMessage,
      setError,
      revokeInstallation,
      createProvision,
      createKey,
      registerFm1Key,
    }),
    [
      loading,
      busy,
      error,
      message,
      overview,
      clients,
      provisions,
      keys,
      activations,
      reload,
      revokeInstallation,
      createProvision,
      createKey,
      registerFm1Key,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminWorkspace outside provider");
  return ctx;
}
