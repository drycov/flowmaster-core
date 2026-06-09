import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    from: vi.fn(),
  },
}));

vi.mock("@/lib/access/enforcement.server", () => ({
  enforceModuleLicense: vi.fn().mockResolvedValue(undefined),
  requireModuleAccess: vi.fn().mockResolvedValue(undefined),
}));

import { enforceModuleLicense, requireModuleAccess } from "@/lib/access/enforcement.server";

let applyDocumentStatusTransition: typeof import("./status-transition.server").applyDocumentStatusTransition;

beforeAll(async () => {
  ({ applyDocumentStatusTransition } = await import("./status-transition.server"));
});

type DocRow = {
  id: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  legal_hold: boolean | null;
};

function makeSupabase(options: {
  doc?: DocRow | null;
  docErr?: { message: string };
  isAdmin?: boolean;
  updateError?: { message: string };
}): SupabaseClient {
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "is_admin") {
      return { data: options.isAdmin ?? false, error: null };
    }
    return { data: null, error: null };
  });

  const from = vi.fn((table: string) => {
    if (table !== "documents") return {};
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: options.doc ?? null,
            error: options.docErr ?? (options.doc ? null : { message: "not found" }),
          }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: options.updateError ?? null }),
      }),
    };
  });

  return { from, rpc } as unknown as SupabaseClient;
}

describe("applyDocumentStatusTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireModuleAccess).mockResolvedValue(undefined);
    vi.mocked(enforceModuleLicense).mockResolvedValue(undefined);
  });

  it("blocks archive when document is on legal hold", async () => {
    const supabase = makeSupabase({
      doc: {
        id: "doc-1",
        status: "approved",
        created_by: "user-1",
        assigned_to: null,
        legal_hold: true,
      },
    });

    await expect(
      applyDocumentStatusTransition(supabase, "user-1", "doc-1", "archived"),
    ).rejects.toThrow("legal hold");

    expect(enforceModuleLicense).toHaveBeenCalledWith(supabase, "archive", "write");
  });

  it("requires archive module access for archived status", async () => {
    const supabase = makeSupabase({
      doc: {
        id: "doc-1",
        status: "approved",
        created_by: "user-1",
        assigned_to: null,
        legal_hold: false,
      },
    });

    await applyDocumentStatusTransition(supabase, "user-1", "doc-1", "archived");

    expect(requireModuleAccess).toHaveBeenCalledWith(supabase, "user-1", "archive", {
      action: "write",
    });
  });

  it("rejects cancel by non-author non-admin", async () => {
    const supabase = makeSupabase({
      doc: {
        id: "doc-1",
        status: "draft",
        created_by: "author-1",
        assigned_to: null,
        legal_hold: false,
      },
      isAdmin: false,
    });

    await expect(
      applyDocumentStatusTransition(supabase, "user-2", "doc-1", "cancelled"),
    ).rejects.toThrow("Только автор или администратор");
  });

  it("allows draft transition for participant from returned_for_revision", async () => {
    const supabase = makeSupabase({
      doc: {
        id: "doc-1",
        status: "returned_for_revision",
        created_by: "user-1",
        assigned_to: null,
        legal_hold: false,
      },
    });

    await applyDocumentStatusTransition(supabase, "user-1", "doc-1", "draft");

    expect(requireModuleAccess).toHaveBeenCalledWith(supabase, "user-1", "documents", {
      action: "write",
    });
  });
});
