import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { isAuthenticated } from "@/lib/auth/session-storage";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!isAuthenticated()) {
      const { tryRestoreSession } = await import("@/lib/auth/client/session-restore");
      const restored = await tryRestoreSession();
      if (!restored) throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
