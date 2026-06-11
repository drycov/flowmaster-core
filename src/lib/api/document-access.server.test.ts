import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/access/rbac.server", () => ({
  requirePermission: vi.fn(),
}));

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requirePermission } from "@/lib/access/rbac.server";
import {
  assertCanEditDocument,
  assertCanViewDocument,
  assertCanViewDocumentContent,
} from "./document-access.server";

function makeSupabase(doc: { status: string; created_by: string } | null) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: doc,
            error: doc ? null : { message: "not found" },
          }),
        }),
      }),
    })),
  } as unknown as SupabaseClient;
}

describe("document-access.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assertCanViewDocument rejects when RPC returns false", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: false, error: null } as never);
    await expect(
      assertCanViewDocument(makeSupabase(null), "user-1", "doc-1"),
    ).rejects.toThrow("Нет доступа к документу");
  });

  it("assertCanViewDocumentContent rejects when RPC returns false", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: false, error: null } as never);
    await expect(
      assertCanViewDocumentContent(makeSupabase(null), "user-1", "doc-1"),
    ).rejects.toThrow("Нет доступа к содержимому документа");
  });

  it("assertCanEditDocument allows author on draft", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("forbidden"));
    const supabase = makeSupabase({ status: "draft", created_by: "user-1" });
    await expect(assertCanEditDocument(supabase, "user-1", "doc-1")).resolves.toBeUndefined();
  });

  it("assertCanEditDocument rejects non-author without manage_documents", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("forbidden"));
    const supabase = makeSupabase({ status: "draft", created_by: "author-1" });
    await expect(assertCanEditDocument(supabase, "user-2", "doc-1")).rejects.toThrow(
      "Нет права редактировать документ",
    );
  });
});
