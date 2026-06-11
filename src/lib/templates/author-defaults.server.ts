import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchProfileById, type ProfileRow } from "@/lib/auth/server/profiles";
import {
  buildAuthorTemplateDefaults,
  buildOrganizationTemplateDefaults,
  resolveSignatoryUserId,
  type DepartmentHeadSource,
} from "./author-field-values";

async function loadDepartment(
  departmentId: string,
): Promise<DepartmentHeadSource & { parent_id: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("head_user_id, parent_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return {
    head_user_id: data?.head_user_id ?? null,
    parent_id: data?.parent_id ?? null,
  };
}

export async function buildTemplateAuthorDefaultsForUser(
  userId: string,
): Promise<Record<string, string>> {
  const authorProfile = await fetchProfileById(userId);
  if (!authorProfile) return {};

  const departmentId = authorProfile.department_id as string | null | undefined;

  let department: DepartmentHeadSource | null = null;
  let parentDepartment: DepartmentHeadSource | null = null;

  if (departmentId) {
    const dept = await loadDepartment(departmentId);
    department = dept;
    if (dept.parent_id) {
      parentDepartment = await loadDepartment(dept.parent_id);
    }
  }

  const { data: managerId, error: mgrErr } = await supabaseAdmin.rpc(
    "user_manager" as never,
    { _user: userId } as never,
  );
  if (mgrErr) throw new Error(mgrErr.message);

  const signatoryUserId = resolveSignatoryUserId(
    userId,
    department,
    parentDepartment,
    managerId as string | null,
  );

  let signatoryProfile: ProfileRow | null = authorProfile;
  if (signatoryUserId !== userId) {
    signatoryProfile = await fetchProfileById(signatoryUserId);
  }

  const { data: orgRow, error: orgErr } = await supabaseAdmin
    .from("organization")
    .select("name_ru, name_kk")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);

  return {
    ...buildOrganizationTemplateDefaults(orgRow),
    ...buildAuthorTemplateDefaults(authorProfile, signatoryProfile),
  };
}
