import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { authFull, NCALayerError } from "@/lib/ncalayer";
import { createAuthChallenge, completeEdsAuth } from "@/lib/api/auth.functions";
import { setSession } from "@/lib/auth/session-storage";
import { resetSupabaseClient } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { ncalayerErrorMessage } from "@/i18n/ncalayer-messages";
import { parseServerValidationError } from "../validation";
import type { AuthMode } from "../types";

export function useEdsAuth() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const signInWithEds = async (
    mode: AuthMode,
    fullNameRu?: string,
    fullNameKk?: string,
    linkEmail?: string,
    linkPassword?: string,
    tenantSlug?: string,
    bootstrapOrg?: { orgNameRu?: string; orgNameKk?: string },
  ) => {
    setLoading(true);
    try {
      const purpose = mode === "signup" ? "register" : "login";
      const challenge = await createAuthChallenge({ data: { purpose } });
      const signed = await authFull(challenge.challenge_b64);

      const result = await completeEdsAuth({
        data: {
          challenge_id: challenge.challenge_id,
          signature: signed.signature,
          cert_info: {
            subject: signed.certInfo.subject,
            issuer: signed.certInfo.issuer,
            serial: signed.certInfo.serial,
            iin: signed.certInfo.iin,
            bin: signed.certInfo.bin,
            cn: signed.certInfo.cn,
          },
          full_name_ru: fullNameRu,
          full_name_kk: fullNameKk || fullNameRu,
          link_email: linkEmail || undefined,
          link_password: linkPassword || undefined,
          tenant_slug: tenantSlug?.trim() || undefined,
          org_name_ru: bootstrapOrg?.orgNameRu,
          org_name_kk: bootstrapOrg?.orgNameKk,
        },
      });

      setSession(result.access_token, result.user, result.access_expires_in);
      resetSupabaseClient();

      toast.success(
        result.is_new_user ? t("auth.toast.edsSignUpSuccess") : t("auth.toast.edsSignInSuccess"),
      );
      navigate({ to: "/dashboard" });
    } catch (e) {
      if (e instanceof NCALayerError) {
        toast.error(ncalayerErrorMessage(t, e));
      } else {
        const fallback = t("auth.toast.edsError");
        const message =
          e instanceof Error ? (parseServerValidationError(e.message, t) ?? e.message) : fallback;
        toast.error(message);
      }
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { loading, signInWithEds };
}
