export { PROFILE_SELECT, APP_ROLES, type AppRole } from "./constants";
export {
  fetchProfileById,
  fetchUserRoles,
  mapProfileRow,
  normalizeProfileNames,
  type ProfileRow,
} from "./profiles";
export { issueAppSession } from "./sessions";
export {
  authenticateUser,
  enableEmailLoginForUser,
  ensureAdminRole,
  registerUser,
  setUserRole,
  type RegisterUserInput,
} from "./users";
export {
  attachEdsToProfile,
  assertIinAvailable,
  consumeAuthChallenge,
  displayNameFromCert,
  edsEmail,
  extractIin,
  findProfileByIin,
  isEdsPlaceholderEmail,
  resolveAuthMethod,
  verifyCnMatchesProfile,
  type CertInfo,
} from "./eds";
