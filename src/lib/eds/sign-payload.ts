import forge from "node-forge";

/** Base64 payload signed via NCALayer (UTF-8 safe). */
export function toSignPayloadBase64(text?: string): string {
  if (!text) return "";
  if (typeof Buffer !== "undefined") {
    return Buffer.from(text, "utf8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(text)));
}

export function sha256HexUtf8(text: string): string {
  const md = forge.md.sha256.create();
  md.update(text, "utf8");
  return md.digest().toHex();
}

/** SHA-256 of the base64 string that was passed to NCALayer signCMS. */
export function hashSignPayloadBase64(b64: string): string {
  return sha256HexUtf8(b64);
}
