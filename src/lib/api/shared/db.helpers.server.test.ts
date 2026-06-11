import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertRow } from "./db.helpers.server";

function makeSupabase() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const insertSingle = vi.fn().mockResolvedValue({
    data: { id: "new-id", name: "Test" },
    error: null,
  });
  const insert = vi.fn(() => ({
    select: () => ({ single: insertSingle }),
  }));
  const upsertMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: "upsert-id" },
    error: null,
  });
  const upsert = vi.fn(() => ({
    select: () => ({ maybeSingle: upsertMaybeSingle }),
  }));

  const from = vi.fn(() => ({ update, insert, upsert }));

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    update,
    updateEq,
    insert,
    insertSingle,
    upsert,
    upsertMaybeSingle,
  };
}

describe("upsertRow", () => {
  it("updates by id when id is provided", async () => {
    const sb = makeSupabase();
    const result = await upsertRow({
      supabase: sb.client,
      table: "items",
      row: { id: "item-1", name: "Updated" },
      id: "item-1",
    });

    expect(sb.from).toHaveBeenCalledWith("items");
    expect(sb.update).toHaveBeenCalled();
    expect(sb.updateEq).toHaveBeenCalledWith("id", "item-1");
    expect(result).toMatchObject({ id: "item-1", name: "Updated" });
  });

  it("inserts when onConflict is omitted", async () => {
    const sb = makeSupabase();
    const result = await upsertRow({
      supabase: sb.client,
      table: "items",
      row: { id: "ignored", name: "New" },
      insertOnly: { created_by: "user-1" },
    });

    expect(sb.insert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "new-id", name: "Test" });
  });

  it("upserts when onConflict is set", async () => {
    const sb = makeSupabase();
    const result = await upsertRow({
      supabase: sb.client,
      table: "items",
      row: { id: "ignored", code: "A1", name: "Row" },
      onConflict: "code",
    });

    expect(sb.upsert).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "upsert-id" });
  });

  it("throws on insert error", async () => {
    const sb = makeSupabase();
    sb.insertSingle.mockResolvedValueOnce({ data: null, error: { message: "duplicate" } });

    await expect(
      upsertRow({
        supabase: sb.client,
        table: "items",
        row: { name: "X" },
      }),
    ).rejects.toThrow("duplicate");
  });
});
