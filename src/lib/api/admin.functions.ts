/** Barrel re-exports — implementation split by domain. */
export type { MyProfileResponse } from "./admin-profile.functions";
export { getMyProfile, getUserProfile } from "./admin-profile.functions";

export {
  listUsers,
  setUserAccessLevel,
  setUserRole,
  createUser,
  adminResetUserPassword,
} from "./admin-users.functions";

export {
  listDepartments,
  upsertDepartment,
  listUsersBrief,
  listDepartmentsBrief,
  listRolesBrief,
} from "./admin-org.functions";

export { listAuditLogs } from "./admin-audit.functions";

export { listNotifications, markNotificationsRead } from "./admin-notifications.functions";

export {
  listPermissions,
  listRolesV2,
  upsertRoleV2,
  setRolePermissions,
  listRoleGrants,
  grantRole,
  revokeRoleGrant,
} from "./admin-roles.functions";
