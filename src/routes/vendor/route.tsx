import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getVendorAdminAvailability } from "@/lib/api/vendor-auth.functions";

export const Route = createFileRoute("/vendor")({
  beforeLoad: async () => {
    const avail = await getVendorAdminAvailability();
    if (!avail.available) {
      throw redirect({ to: "/" });
    }
  },
  component: VendorShell,
});

function VendorShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
