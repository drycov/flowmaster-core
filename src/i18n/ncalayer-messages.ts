import type { NCALayerError } from "@/lib/ncalayer";
import type { TFunction } from "./index";
import { interpolate } from "./helpers";

export function ncalayerErrorMessage(t: TFunction, e: NCALayerError): string {
  const msg = e.message.toLowerCase();
  if (msg.includes("not available") || msg.includes("timeout")) {
    return t("ncalayer.unavailable");
  }
  if (
    msg.includes("no active certificate") ||
    msg.includes("не выбран") ||
    msg.includes("not selected") ||
    msg.includes("auth signature not found") ||
    msg.includes("signature not found")
  ) {
    return t("ncalayer.noCert");
  }
  if (msg.includes("иин") || msg.includes("iin")) {
    return t("ncalayer.noIin");
  }
  if (msg.includes("cancel") || msg.includes("отмен")) {
    return t("ncalayer.cancelled");
  }
  return interpolate(t("ncalayer.error"), { message: e.message });
}
