import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireModule } from "@/lib/access/route-guards";

export const Route = createFileRoute("/_authenticated/admin/license")({
  beforeLoad: async () => {
    await requireModule("admin_license");
    throw redirect({ to: "/admin/settings", search: { tab: "license" } });
  },
});
