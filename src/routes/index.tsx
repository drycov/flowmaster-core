import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth/session-storage";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      if (!isAuthenticated()) {
        const { tryRestoreSession } = await import("@/lib/auth/client/session-restore");
        await tryRestoreSession();
      }
      if (isAuthenticated()) {
        throw redirect({ to: "/dashboard" });
      }
    }
    throw redirect({ to: "/auth" });
  },
});
