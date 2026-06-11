import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import {
  getVendorAdminSession,
  loginVendorAdmin,
} from "@/lib/api/vendor-auth.functions";

export const Route = createFileRoute("/vendor/license/")({
  beforeLoad: async () => {
    const session = await getVendorAdminSession();
    if (session.authenticated) {
      throw redirect({ to: "/vendor/license/console" });
    }
  },
  component: VendorLicenseLoginPage,
});

function VendorLicenseLoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => loginVendorAdmin({ data: { support_code: code.trim() } }),
    onSuccess: () => {
      toast.success(t("vendorAuth.loginSuccess"));
      void navigate({ to: "/vendor/license/console" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle>{t("vendorAuth.title")}</CardTitle>
          <CardDescription>{t("vendorAuth.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("vendorAuth.hint")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-code">{t("vendorAuth.codeLabel")}</Label>
            <Input
              id="support-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="12345678"
              className="font-mono text-lg tracking-widest"
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </div>
          <Button
            className="w-full"
            disabled={code.length < 8 || loginMutation.isPending}
            onClick={() => loginMutation.mutate()}
          >
            {loginMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {t("vendorAuth.loginBtn")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
