import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  beforeLoad: async () => {
    await requireModule("integrations", "read");
    throw redirect({ to: "/admin/settings", search: { tab: "integrations" } });
  },
});
