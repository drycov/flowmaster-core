import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { AdminApp } from "./pages/AdminApp";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminVerifyPage } from "./pages/AdminVerifyPage";
import { CabinetPage } from "./pages/CabinetPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { RegisterPage } from "./pages/RegisterPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/onboarding"
        element={
          <Protected>
            <OnboardingPage />
          </Protected>
        }
      />
      <Route
        path="/cabinet"
        element={
          <Protected>
            <CabinetPage />
          </Protected>
        }
      />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/verify" element={<AdminVerifyPage />} />
      <Route path="/admin/app/*" element={<AdminApp />} />
      <Route path="/admin/console" element={<Navigate to="/admin/app" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
