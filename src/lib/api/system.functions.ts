import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SystemInitStatus = {
  has_organization: boolean;
  organization_configured: boolean;
  has_admin: boolean;
  admin_count: number;
  departments_count: number;
  permissions_count: number;
  roles_count: number;
  published_workflows: number;
  published_templates: number;
  needs_setup: boolean;
};

export const getSystemInitStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc(
      "get_system_init_status" as never,
    );
    if (error) {
      // Fallback before migration applied
      const [{ count: adminCount }, { count: deptCount }] = await Promise.all([
        context.supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin" as never),
        context.supabase
          .from("departments")
          .select("id", { count: "exact", head: true }),
      ]);
      return {
        has_organization: true,
        organization_configured: false,
        has_admin: (adminCount ?? 0) > 0,
        admin_count: adminCount ?? 0,
        departments_count: deptCount ?? 0,
        permissions_count: 0,
        roles_count: 0,
        published_workflows: 0,
        published_templates: 0,
        needs_setup: (adminCount ?? 0) === 0 || (deptCount ?? 0) === 0,
      } satisfies SystemInitStatus;
    }
    return data as SystemInitStatus;
  });
