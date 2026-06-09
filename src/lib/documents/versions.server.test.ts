import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveNextDocumentVersionNo } from "./versions.server";

function makeSupabase(currentVersion: number | null, maxVersionNo: number | null) {
  const from = vi.fn((table: string) => {
    if (table === "documents") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: currentVersion !== null ? { current_version: currentVersion } : null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "document_versions") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data:
                  maxVersionNo !== null ? [{ version_no: maxVersionNo }] : [],
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    return {};
  });

  return { from } as unknown as SupabaseClient;
}

describe("resolveNextDocumentVersionNo", () => {
  it("returns 1 when no versions exist", async () => {
    const supabase = makeSupabase(0, null);
    await expect(resolveNextDocumentVersionNo(supabase, "doc-1")).resolves.toBe(1);
  });

  it("uses max of current_version and latest version row", async () => {
    const supabase = makeSupabase(2, 5);
    await expect(resolveNextDocumentVersionNo(supabase, "doc-1")).resolves.toBe(6);
  });

  it("increments from current_version when higher than version rows", async () => {
    const supabase = makeSupabase(7, 3);
    await expect(resolveNextDocumentVersionNo(supabase, "doc-1")).resolves.toBe(8);
  });
});
