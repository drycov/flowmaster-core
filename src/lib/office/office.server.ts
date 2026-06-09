import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";

export function officeDocumentKey(docId: string, versionNo: number, updatedAt: string): string {
  const hash = createHash("sha256")
    .update(`${docId}:${versionNo}:${updatedAt}`)
    .digest("hex")
    .slice(0, 16);
  return `${docId}-v${versionNo}-${hash}`;
}

/** Process ONLYOFFICE save callback (status 2 = must save). */
export async function processOfficeCallback(body: {
  key?: string;
  status?: number;
  url?: string;
}) {
  if (body.status !== 2 || !body.url || !body.key) {
    return { ok: true, saved: false };
  }

  const docId = body.key.split("-")[0];
  if (!docId) throw new Error("invalid document key");

  const res = await fetch(body.url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const { data: doc } = await supabaseAdmin
    .from("documents")
    .select("current_version, created_by")
    .eq("id", docId)
    .single();

  const nextVersion = (doc?.current_version ?? 0) + 1;
  const storagePath = `${docId}/v${nextVersion}/office-save.docx`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKETS.documents)
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (uploadErr) throw new Error(uploadErr.message);

  const contentHash = createHash("sha256").update(buffer).digest("hex");

  await supabaseAdmin.from("document_versions").insert({
    document_id: docId,
    version_no: nextVersion,
    file_path: storagePath,
    file_format: "docx",
    comment: "ONLYOFFICE",
    content_hash: contentHash,
    created_by: doc?.created_by,
  } as never);

  await supabaseAdmin
    .from("documents")
    .update({ current_version: nextVersion } as never)
    .eq("id", docId);

  return { ok: true, saved: true, version_no: nextVersion };
}
