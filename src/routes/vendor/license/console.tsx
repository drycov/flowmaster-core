import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { LicenseServerConsole } from "@/components/vendor/LicenseServerConsole";
import { getVendorAdminSession, logoutVendorAdmin } from "@/lib/api/vendor-auth.functions";

export const Route = createFileRoute("/vendor/license/console")({
  beforeLoad: async () => {
    const session = await getVendorAdminSession();
    if (!session.authenticated) {
      throw redirect({ to: "/vendor/license" });
    }
  },
  component: VendorLicenseConsolePage,
});

function VendorLicenseConsolePage() {
  const navigate = useNavigate();
  const logoutMutation = useMutation({
    mutationFn: () => logoutVendorAdmin(),
    onSuccess: () => {
      void navigate({ to: "/vendor/license" });
    },
  });

  return (
    <LicenseServerConsole onLogout={() => logoutMutation.mutate()} />
  );
}
