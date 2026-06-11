import { Navigate, Route, Routes } from "react-router-dom";
import { AdminShell } from "../components/admin/AdminShell";
import { AdminWorkspaceProvider } from "../hooks/useAdminWorkspace";
import { useAdminSession } from "../hooks/useAdminSession";
import { AdminActivationsPage } from "./admin/AdminActivationsPage";
import { AdminClientsPage } from "./admin/AdminClientsPage";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminInstallationsPage } from "./admin/AdminInstallationsPage";
import { AdminKeysPage } from "./admin/AdminKeysPage";
import { AdminToolsPage } from "./admin/AdminToolsPage";

export function AdminApp() {
  const { session, loading } = useAdminSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  if (!session?.authenticated) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <AdminWorkspaceProvider>
      <Routes>
        <Route element={<AdminShell />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="clients" element={<AdminClientsPage />} />
          <Route path="installations" element={<AdminInstallationsPage />} />
          <Route path="activations" element={<AdminActivationsPage />} />
          <Route path="keys" element={<AdminKeysPage />} />
          <Route path="tools" element={<AdminToolsPage />} />
        </Route>
      </Routes>
    </AdminWorkspaceProvider>
  );
}
