import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { authFull, NCALayerError } from "@/lib/ncalayer";
import { createAuthChallenge, completeEdsAuth } from "@/lib/api/auth.functions";
import { setSession } from "@/lib/auth/session-storage";
import { resetSupabaseClient } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { ncalayerErrorMessage } from "@/i18n/ncalayer-messages";
import type { AuthMode } from "../types";

export function useEdsAuth() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const signInWithEds = async (
    mode: AuthMode,
    fullName?: string,
    linkEmail?: string,
    linkPassword?: string,
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
          full_name_ru: fullName,
          full_name_kk: fullName,
          link_email: linkEmail || undefined,
          link_password: linkPassword || undefined,
        },
      });

      setSession(result.access_token, result.user);
      resetSupabaseClient();

      toast.success(
        result.is_new_user ? t("auth.toast.edsSignUpSuccess") : t("auth.toast.edsSignInSuccess"),
      );
      navigate({ to: "/dashboard" });
    } catch (e) {
      if (e instanceof NCALayerError) {
        toast.error(ncalayerErrorMessage(t, e));
      } else {
        toast.error(e instanceof Error ? e.message : t("auth.toast.edsError"));
      }
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { loading, signInWithEds };
}
