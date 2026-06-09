import { useState } from "react";
import { toast } from "sonner";
import { authFull, NCALayerError } from "@/lib/ncalayer";
import { createAuthChallenge, linkEdsToProfile } from "@/lib/api/auth.functions";
import { useI18n } from "@/i18n";
import { ncalayerErrorMessage } from "@/i18n/ncalayer-messages";

export function useEdsLink(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const linkEds = async () => {
    setLoading(true);
    try {
      const challenge = await createAuthChallenge({ data: { purpose: "link" } });
      const signed = await authFull(challenge.challenge_b64);

      await linkEdsToProfile({
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
        },
      });

      toast.success(t("ncalayer.edsLinked"));
      onSuccess?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      if (e instanceof NCALayerError) {
        toast.error(ncalayerErrorMessage(t, e));
      } else {
        toast.error(e instanceof Error ? e.message : t("ncalayer.edsLinkError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return { loading, linkEds };
}
